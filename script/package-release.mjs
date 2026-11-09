#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readdir, lstat, readFile, mkdir, copyFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '../skills/nodeclaw-image-gen/scripts/distribution.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, out: { type: 'string' } } });
const identity = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const files = [];
async function collect(relative) {
  const file = path.join(root, relative); const info = await lstat(file);
  if (info.isSymbolicLink()) throw new Error('Release excludes symbolic links');
  if (info.isDirectory()) {
    for (const name of (await readdir(file)).sort()) await collect(`${relative}/${name}`);
  } else if (info.isFile()) {
    if (info.size > 8 * 1024 * 1024) throw new Error('Oversized release source');
    files.push(relative);
  } else throw new Error('Release accepts ordinary files only');
}
// Explicit package owners only: no platform files, user config, state or captures.
for (const relative of ['package.json', 'skills', 'script', 'tests', 'design', 'changelog', 'docs', 'diagram', '.claude-plugin', '.github/workflows/verify.yml']) await collect(relative);
for (const relative of ['README.md', 'config.example.json']) {
  try { await collect(relative); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const manifest = { schemaVersion: 1, package: identity.name, version: identity.version, kind: 'skill', files: [] };
const content = { schemaVersion: 1, package: identity.name, version: identity.version, minClientVersion: '0.1.1', kind: 'content', files: [] };
for (const [index, relative] of files.entries()) {
  const bytes = await readFile(path.join(root, relative));
  const row = { path: relative, asset: `file-${String(index).padStart(4, '0')}-${path.basename(relative)}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  manifest.files.push(row);
  if (/^skills\/nodeclaw-image-gen\/(styles|techniques)\//.test(relative)) content.files.push({ ...row, path: relative.replace('skills/nodeclaw-image-gen/', '') });
}
validateManifest(manifest); validateManifest(content);
if (values['dry-run']) console.log(JSON.stringify({ status: 'prepared', version: identity.version, files: files.length, contentFiles: content.files.length, archive: `nodeclaw-image-gen-${identity.version}.tar.gz`, publication: 'not_performed' }));
else {
  const output = path.resolve(values.out || path.join(root, 'dist', `v${identity.version}`));
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output, { recursive: false, mode: 0o700 });
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'nodeclaw-image-package-'));
  try {
    const payload = path.join(temporary, `Nodeclaw-Image-Gen-${identity.version}`); await mkdir(payload);
    for (const row of manifest.files) {
      const source = path.join(root, row.path);
      const copy = path.join(payload, row.path); await mkdir(path.dirname(copy), { recursive: true });
      await copyFile(source, copy); await copyFile(source, path.join(output, row.asset));
    }
    await writeFile(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await writeFile(path.join(output, 'content-manifest.json'), JSON.stringify(content, null, 2), { flag: 'wx' });
    const archive = `nodeclaw-image-gen-${identity.version}.tar.gz`;
    const tar = spawnSync('tar', ['-czf', path.join(output, archive), '-C', temporary, path.basename(payload)], { encoding: 'utf8', timeout: 60000, maxBuffer: 16384 });
    if (tar.status !== 0) throw new Error('Release packaging requires a working local tar command; no installer/runtime archive parser is needed');
    const checksums = [];
    for (const name of (await readdir(output)).sort()) checksums.push(`${createHash('sha256').update(await readFile(path.join(output, name))).digest('hex')}  ${name}`);
    await writeFile(path.join(output, 'SHA256SUMS'), `${checksums.join('\n')}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ status: 'packaged', output, version: identity.version, files: manifest.files.length, publication: 'not_performed' }));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
