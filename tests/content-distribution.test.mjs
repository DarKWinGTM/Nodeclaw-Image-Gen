import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTechnique, listContent, syncContent, fetchDocs } from '../skills/nodeclaw-image-gen/scripts/content.mjs';
import { validateManifest, stageRelease, installSkill } from '../skills/nodeclaw-image-gen/scripts/distribution.mjs';
import { resolveContext } from '../skills/nodeclaw-image-gen/scripts/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
async function workspace(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-distribution-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const context = await resolveContext({ cli: {}, env: {}, cwd: dir, homeDir: dir });
  return { dir, context };
}

test('bundled techniques load independently of style presets and reject executable workflow paths', async t => {
  const { context } = await workspace(t);
  const pixel = await loadTechnique('pixel-art-detail', context);
  assert.equal(pixel.id, 'pixel-art-detail');
  assert.equal(pixel.parameters.scale.default, 3);
  assert.ok(pixel.workflowText.includes('nearest'));
  assert.ok(pixel.requires.includes('local.raster'));
  const styles = await listContent('styles', context);
  assert.ok(styles.items.some(s => s.id === 'tarot-ink'));
  const custom = path.join(context.dataDir, 'custom', 'techniques', 'bad'); await mkdir(custom, { recursive: true });
  await writeFile(path.join(custom, 'technique.json'), JSON.stringify({ ...pixel, workflow: '../run.mjs', id: 'bad' }));
  await assert.rejects(loadTechnique('custom:bad', context), /workflow/i);
});

test('manifest validation blocks traversal, collisions and executable content packs', () => {
  const row = { path: 'techniques/example/WORKFLOW.md', asset: 'file-0', bytes: 2, sha256: hash('ok') };
  const manifest = { schemaVersion: 1, package: 'nodeclaw-image-gen', version: '0.1.0', kind: 'content', files: [row] };
  assert.equal(validateManifest(manifest).files.length, 1);
  for (const invalid of ['../escape.md', '/absolute.md', 'techniques\\escape.md', 'scripts/run.mjs', 'techniques/x/run.mjs']) {
    assert.throws(() => validateManifest({ ...manifest, files: [{ ...row, path: invalid }] }));
  }
  assert.throws(() => validateManifest({ ...manifest, files: [row, { ...row, path: row.path.toUpperCase(), asset: 'file-1' }] }));
});

test('staging verifies bytes before mutation and content sync preserves custom namespace', async t => {
  const { dir, context } = await workspace(t);
  const assets = path.join(dir, 'assets'); await mkdir(assets);
  const source = '# example workflow'; await writeFile(path.join(assets, 'workflow'), source);
  const manifest = { schemaVersion: 1, package: 'nodeclaw-image-gen', version: '0.1.0', kind: 'content', files: [{ path: 'techniques/example/WORKFLOW.md', asset: 'workflow', bytes: Buffer.byteLength(source), sha256: hash(source) }] };
  const custom = path.join(context.dataDir, 'custom', 'techniques'); await mkdir(custom, { recursive: true });
  await writeFile(path.join(custom, 'keep.json'), 'user-owned');
  const result = await syncContent({ kind: 'techniques', source: { manifest, assetsDir: assets }, context });
  assert.equal(result.status, 'synced');
  assert.equal(await readFile(path.join(custom, 'keep.json'), 'utf8'), 'user-owned');
  await writeFile(path.join(assets, 'workflow'), 'tampered');
  await assert.rejects(stageRelease(manifest, { source: { assetsDir: assets }, stagingDir: path.join(dir, 'stage') }), /integrity/i);
  assert.equal(await readFile(path.join(result.directory, 'techniques/example/WORKFLOW.md'), 'utf8'), source);
});

test('standalone install is complete, no-clobber by default and preserves external user data', async t => {
  const { dir } = await workspace(t);
  const target = path.join(dir, 'skills', 'nodeclaw-image-gen');
  const sourceDir = path.join(root, 'skills/nodeclaw-image-gen');
  await installSkill({ sourceDir, targetDir: target });
  const cli = path.join(target, 'scripts/image-gen.mjs');
  const run = spawnSync(process.execPath, [cli, '--help'], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /Generate|generate/);
  await assert.rejects(installSkill({ sourceDir, targetDir: target }), /replace/i);
  const userFile = path.join(dir, 'config.json'); await writeFile(userFile, 'user config');
  await installSkill({ sourceDir, targetDir: target, replaceConfirmed: true });
  assert.equal(await readFile(userFile, 'utf8'), 'user config');
  const linkSource = path.join(dir, 'linked'); await mkdir(linkSource); await symlink(userFile, path.join(linkSource, 'outside.json'));
  await assert.rejects(installSkill({ sourceDir: linkSource, targetDir: path.join(dir, 'unsafe') }));
});

test('optional docs failure remains a reference limit, not an image request gate', async t => {
  const { context } = await workspace(t);
  const absent = await fetchDocs({ ...context, endpoints: [{ baseUrl: 'https://custom.example', apiDocsUrl: null }] });
  assert.equal(absent.status, 'not_configured');
  const unavailable = await fetchDocs(context, { fetchImpl: async () => new Response('', { status: 503 }) });
  assert.equal(unavailable.status, 'unavailable');
});
