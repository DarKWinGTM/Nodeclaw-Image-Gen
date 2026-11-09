import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
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
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), 'image-distribution-'));
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
  assert.equal(pixel.tool, 'pixel-art-detail');
  const styles = await listContent('styles', context);
  assert.ok(styles.items.some(s => s.id === 'tarot-ink'));
  const custom = path.join(context.dataDir, 'custom', 'techniques', 'bad'); await mkdir(custom, { recursive: true });
  await writeFile(path.join(custom, 'technique.json'), JSON.stringify({ ...pixel, workflow: '../run.mjs', id: 'bad' }));
  await assert.rejects(loadTechnique('custom:bad', context), /workflow/i);
  await writeFile(path.join(custom, 'technique.json'), JSON.stringify({ ...pixel, workflow: 'WORKFLOW.md', id: 'bad', minClientVersion: '99.0.0' }));
  await writeFile(path.join(custom, 'WORKFLOW.md'), 'Example');
  await assert.rejects(loadTechnique('custom:bad', context), /newer full skill/i);
  await writeFile(path.join(custom, 'technique.json'), JSON.stringify({ ...pixel, workflow: 'WORKFLOW.md', id: 'bad', tool: '../run.mjs' }));
  await assert.rejects(loadTechnique('custom:bad', context), /shipped technique tool/i);
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
  const { createRequire } = await import('node:module');
  const png = createRequire(import.meta.url)('../skills/nodeclaw-image-gen/vendor/pngjs/lib/png-sync.js');
  const image = path.join(dir, 'sample.png');
  await writeFile(image, png.write({ width: 1, height: 1, data: Buffer.from([1, 2, 3, 255]) }));
  const prepared = spawnSync(process.execPath, [cli, 'techniques', 'prepare', 'pixel-art-detail', '--image', image, '--work-dir', path.join(dir, 'job'), '--tile-size', '4', '--json'], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).paidRequestsSent, 0);
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
