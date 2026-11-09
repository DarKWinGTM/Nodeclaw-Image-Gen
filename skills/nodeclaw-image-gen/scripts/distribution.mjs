import { mkdir, readdir, lstat, copyFile, rename, rm, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inputError } from './config.mjs';
import { readBounded, requestJson } from './http.mjs';
import { atomicJson, readJsonFile } from './output.mjs';

export const REPOSITORY = 'DarKWinGTM/Nodeclaw-Image-Gen';
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = 'nodeclaw-image-gen';
const versionPattern = /^\d+\.\d+\.\d+$/;
export const CLIENT_VERSION = JSON.parse(await readFile(path.join(SKILL_ROOT, 'package.json'), 'utf8')).version;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function safePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value.includes('\\') || value.includes(':') || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /[\x00-\x1f<>"|?*]/.test(p) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p))) throw inputError('Unsafe manifest path');
  return value;
}

export function validateManifest(manifest, { packageName = PACKAGE, version, kind } = {}) {
  if (manifest?.schemaVersion !== 1 || manifest.package !== packageName || !versionPattern.test(manifest.version) || !['skill', 'content'].includes(manifest.kind) || kind && manifest.kind !== kind || version && manifest.version !== version) throw inputError('Unsupported release manifest identity/version/kind');
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 512) throw inputError('Invalid manifest file count');
  if (manifest.minClientVersion && (!versionPattern.test(manifest.minClientVersion) || compareVersions(manifest.minClientVersion, CLIENT_VERSION) > 0)) throw inputError('Content requires a newer client version');
  const paths = new Set(); const assets = new Set(); let total = 0;
  for (const row of manifest.files) {
    safePath(row.path);
    if (typeof row.asset !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(row.asset)) throw inputError('Invalid release asset name');
    const key = row.path.toLowerCase();
    if (paths.has(key) || assets.has(row.asset.toLowerCase())) throw inputError('Duplicate/case-colliding manifest path or asset');
    if ([...paths].some(p => p.startsWith(`${key}/`) || key.startsWith(`${p}/`))) throw inputError('Manifest file/directory collision');
    paths.add(key); assets.add(row.asset.toLowerCase());
    if (!Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(row.sha256)) throw inputError('Invalid manifest integrity metadata');
    total += row.bytes;
    if (manifest.kind === 'content' && (!/^(styles|techniques)\//.test(row.path) || !/\.(json|md)$/.test(row.path))) throw inputError('Content packs may contain only style/technique JSON and Markdown');
  }
  if (total > 32 * 1024 * 1024) throw inputError('Release payload exceeds 32 MiB');
  return manifest;
}

export function compareVersions(a, b) {
  const x = a.split('.').map(Number); const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

export async function treeFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    safePath(relative);
    if (entry.isSymbolicLink()) throw inputError('Symbolic links are not installable payload files');
    if (entry.isDirectory()) files.push(...await treeFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw inputError('Only ordinary files/directories can be installed');
    if (files.length > 512) throw inputError('Payload file count exceeds limit');
  }
  return files.sort();
}

async function rejectSymlinkParents(target) {
  let current = path.resolve(target);
  for (;;) {
    try { if ((await lstat(current)).isSymbolicLink()) throw inputError('Install path cannot traverse symbolic links'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) return; current = parent;
  }
}

export async function stageRelease(manifest, { source, stagingDir, fetchImpl = fetch } = {}) {
  validateManifest(manifest);
  await mkdir(stagingDir, { recursive: false, mode: 0o700 });
  for (const row of manifest.files) {
    let bytes;
    if (source.assetsDir) {
      const file = path.join(source.assetsDir, row.asset);
      if (!(await lstat(file)).isFile()) throw inputError('Release asset must be an ordinary file');
      if ((await lstat(file)).size !== row.bytes) throw inputError('Release asset integrity size mismatch');
      bytes = await readFile(file);
    } else {
      const url = source.assets?.get(row.asset);
      const parsed = url && new URL(url);
      if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.pathname !== `/${source.repository}/releases/download/${source.tag}/${row.asset}`) throw inputError('Asset is not bound to the selected GitHub release');
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000), redirect: 'follow' });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Release asset download failed'); }
      bytes = await readBounded(response, row.bytes);
    }
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256) throw inputError('Release asset integrity hash mismatch');
    const output = path.join(stagingDir, row.path);
    await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
  }
  return { manifest, directory: stagingDir };
}

export async function releaseSource({ repository = REPOSITORY, release = 'latest', manifest, assetsDir, kind = 'skill' } = {}) {
  if (manifest) {
    const value = validateManifest(typeof manifest === 'string' ? await readJsonFile(manifest, 1048576) : manifest, { kind });
    if (!assetsDir) throw inputError('Local manifest requires --assets-dir');
    return { manifest: value, assetsDir: path.resolve(assetsDir) };
  }
  if (repository !== REPOSITORY) throw inputError('This client syncs only from the selected official repository; inspect custom packs locally');
  if (release !== 'latest' && !/^v?\d+\.\d+\.\d+$/.test(release)) throw inputError('Select latest or an exact version tag');
  const route = release === 'latest' ? 'latest' : `tags/${release}`;
  const { data } = await requestJson(`https://api.github.com/repos/${repository}/releases/${route}`, { limit: 1048576, timeoutMs: 30000 });
  if (!/^v\d+\.\d+\.\d+$/.test(data.tag_name)) throw inputError('Release requires a stable version tag');
  const assets = new Map((data.assets || []).map(a => [a.name, a.browser_download_url]));
  const name = kind === 'content' ? 'content-manifest.json' : 'release-manifest.json';
  const url = assets.get(name);
  if (url !== `https://github.com/${repository}/releases/download/${data.tag_name}/${name}`) throw inputError('Missing versioned release manifest asset');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Cannot download release manifest'); }
  const value = validateManifest(JSON.parse((await readBounded(response, 1048576)).toString('utf8')), { version: data.tag_name.slice(1), kind });
  return { manifest: value, assets, repository, tag: data.tag_name };
}

export async function installSkill({ sourceDir, targetDir, replaceConfirmed = false, version } = {}) {
  targetDir = path.resolve(targetDir); sourceDir = path.resolve(sourceDir);
  if (targetDir === sourceDir || sourceDir.startsWith(`${targetDir}${path.sep}`) || targetDir.startsWith(`${sourceDir}${path.sep}`)) throw inputError('Source and install target must be separate trees');
  await rejectSymlinkParents(targetDir); await rejectSymlinkParents(sourceDir);
  const files = await treeFiles(sourceDir);
  const identity = await readJsonFile(path.join(sourceDir, 'package.json'), 65536);
  if (identity.name !== PACKAGE || !versionPattern.test(identity.version) || !files.includes('SKILL.md') || !files.includes('scripts/image-gen.mjs')) throw inputError('Source is not a complete Nodeclaw-Image-Gen skill');
  if (version && identity.version !== version) throw inputError('Staged skill version disagrees with manifest');
  let prior;
  try {
    const info = await lstat(targetDir);
    if (!info.isDirectory()) throw inputError('Target is not a directory');
    if (!replaceConfirmed) throw inputError('Existing target requires explicit --replace confirmation');
    prior = await readJsonFile(path.join(targetDir, '.nodeclaw-install.json'), 131072);
    if (prior.package !== PACKAGE || prior.mode !== 'standalone' || !Array.isArray(prior.files)) throw inputError('Refusing to replace another owner/plugin-managed install');
    const actual = await treeFiles(targetDir);
    if (actual.some(file => file !== '.nodeclaw-install.json' && !prior.files.includes(file))) throw inputError('Unknown files inside existing installation; preserve/move them before replacement');
  } catch (error) { if (error.code !== 'ENOENT') throw error; else if (await lstat(targetDir).catch(() => null)) throw inputError('Target ownership is unknown; replacement refused'); }
  await mkdir(path.dirname(targetDir), { recursive: true });
  const stage = `${targetDir}.stage-${randomUUID()}`; const backup = `${targetDir}.previous-${randomUUID()}`;
  await mkdir(stage, { mode: 0o700 });
  try {
    for (const file of files) {
      const info = await lstat(path.join(sourceDir, file));
      if (!info.isFile() || info.size > 8 * 1024 * 1024) throw inputError('Unsafe or oversized install file');
      await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
      await copyFile(path.join(sourceDir, file), path.join(stage, file));
    }
    await atomicJson(path.join(stage, '.nodeclaw-install.json'), { schemaVersion: 1, package: PACKAGE, version: identity.version, mode: 'standalone', files });
    if (prior) await rename(targetDir, backup);
    try { await rename(stage, targetDir); }
    catch (error) {
      if (prior) {
        try { await rename(backup, targetDir); }
        catch { throw new Error(`Install switch failed; previous install retained at ${backup}`); }
      }
      throw error;
    }
    if (prior) await rm(backup, { recursive: true });
    return { status: 'installed', target: targetDir, version: identity.version, mode: 'standalone' };
  } finally { await rm(stage, { recursive: true, force: true }); }
}

export async function updateCommand(action, context, cli) {
  if (!['check', 'apply'].includes(action)) throw inputError('update supports check or apply');
  const source = await releaseSource({ ...cli, kind: 'skill' });
  if (action === 'check') return { status: 'available', version: source.manifest.version, repository: REPOSITORY };
  if (!cli.yes || !cli.target) throw inputError('update apply requires explicit --yes and --target of a standalone installation');
  const marker = await readJsonFile(path.join(cli.target, '.nodeclaw-install.json'), 131072);
  if (marker.mode !== 'standalone' || marker.package !== PACKAGE) throw inputError('Use the harness plugin manager for plugin-managed updates');
  const temporary = path.join(context.stateDir, `update-${randomUUID()}`);
  await mkdir(context.stateDir, { recursive: true, mode: 0o700 });
  try {
    await stageRelease(source.manifest, { source, stagingDir: temporary });
    return await installSkill({ sourceDir: path.join(temporary, 'skills/nodeclaw-image-gen'), targetDir: cli.target, replaceConfirmed: true, version: source.manifest.version });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
