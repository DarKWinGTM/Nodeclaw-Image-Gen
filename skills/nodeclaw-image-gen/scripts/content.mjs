import { readdir, mkdir, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { SKILL_ROOT, CLIENT_VERSION, compareVersions, releaseSource, stageRelease } from './distribution.mjs';
import { inputError } from './config.mjs';
import { readBounded } from './http.mjs';
import { atomicJson, readJsonFile } from './output.mjs';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function roots(context, kind) {
  const result = [{ directory: path.join(SKILL_ROOT, kind), namespace: 'official' }];
  try {
    const pointer = await readJsonFile(path.join(context.dataDir, 'official', 'current.json'), 65536);
    const bundled = await readJsonFile(path.join(SKILL_ROOT, 'package.json'), 65536);
    if (!/^[0-9a-f-]{36}$/.test(pointer.directory) || !/^\d+\.\d+\.\d+$/.test(pointer.version)) throw new Error('Invalid pack pointer');
    if (compareVersions(pointer.version, bundled.version) >= 0) result.push({ directory: path.join(context.dataDir, 'official', pointer.directory, kind), namespace: 'official' });
  } catch (error) { if (error.code !== 'ENOENT') throw inputError('Official pack state is invalid; inspect the selected content installation'); }
  result.push({ directory: path.join(context.dataDir, 'custom', kind), namespace: 'custom' });
  return result;
}

async function loadEntry(file, kind) {
  if (!(await lstat(file)).isFile()) throw inputError('Pack entry must be an ordinary JSON file');
  const entry = await readJsonFile(file, 65536);
  if (!idPattern.test(entry.id) || typeof entry.name !== 'string' || typeof entry.description !== 'string') throw inputError('Invalid content entry metadata');
  if (kind === 'techniques') {
    if (entry.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(entry.version) || !Array.isArray(entry.requires) || entry.requires.some(v => typeof v !== 'string') || !entry.parameters || typeof entry.parameters !== 'object') throw inputError('Invalid technique contract');
    if (typeof entry.workflow !== 'string' || !/^[A-Za-z0-9_-]+\.md$/.test(entry.workflow)) throw inputError('Technique workflow must be a local Markdown filename, not executable content');
    if (entry.minClientVersion && (!/^\d+\.\d+\.\d+$/.test(entry.minClientVersion) || compareVersions(entry.minClientVersion, CLIENT_VERSION) > 0)) throw inputError('Technique requires a newer full skill update');
    if (entry.tool !== undefined && !['pixel-art-detail', 'preserve-composition'].includes(entry.tool)) throw inputError('Unknown shipped technique tool; content cannot install executable helpers');
    const workflow = path.join(path.dirname(file), entry.workflow);
    if (!(await lstat(workflow)).isFile()) throw inputError('Technique workflow must be an ordinary Markdown file');
    const { readFile } = await import('node:fs/promises');
    if ((await lstat(workflow)).size > 131072) throw inputError('Technique workflow exceeds byte limit');
    entry.workflowText = await readFile(workflow, 'utf8');
  } else if (typeof entry.promptTemplate !== 'string') throw inputError('Style requires a promptTemplate');
  return entry;
}

export async function listContent(kind, context) {
  if (!['styles', 'techniques'].includes(kind)) throw inputError('Unknown content kind');
  const entries = new Map();
  for (const root of await roots(context, kind)) {
    let names;
    try { names = await readdir(root.directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (names.length > 256) throw inputError('Content directory exceeds 256 entries');
    for (const name of names) {
      if (name.isSymbolicLink()) throw inputError('Content entry cannot be a symbolic link');
      const file = name.isDirectory() ? path.join(root.directory, name.name, kind === 'techniques' ? 'technique.json' : 'style.json') : path.join(root.directory, name.name);
      if (!name.isDirectory() && !name.name.endsWith('.json')) continue;
      try {
        const entry = await loadEntry(file, kind);
        const id = root.namespace === 'custom' ? `custom:${entry.id}` : entry.id;
        entries.set(id, { ...entry, id, namespace: root.namespace, source: file });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return { status: 'listed', kind, items: [...entries.values()] };
}

export async function loadTechnique(id, context) {
  const entry = (await listContent('techniques', context)).items.find(item => item.id === id);
  if (!entry) throw inputError('Technique not found; use techniques list');
  return entry;
}

export async function syncContent({ kind, source, context }) {
  if (!['styles', 'techniques', 'all'].includes(kind)) throw inputError('Unknown content kind');
  if (source.manifest.kind !== 'content') throw inputError('Content sync requires a content manifest, not executable skill files');
  const directory = randomUUID();
  const parent = path.join(context.dataDir, 'official');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const target = path.join(parent, directory);
  try {
    await stageRelease(source.manifest, { source, stagingDir: target });
    await atomicJson(path.join(parent, 'current.json'), { schemaVersion: 1, version: source.manifest.version, directory });
    return { status: 'synced', version: source.manifest.version, directory: target, kind: 'official-pack', customPreserved: true };
  } catch (error) { await rm(target, { recursive: true, force: true }); throw error; }
}

export async function fetchDocs(context, { refresh = false, fetchImpl = fetch } = {}) {
  const endpoint = context.endpoints[0]; const url = endpoint.apiDocsUrl;
  if (!url) return { status: 'not_configured', optional: true };
  const id = createHash('sha256').update(`${endpoint.baseUrl}\n${endpoint.provider}\n${url}`).digest('hex');
  const file = path.join(context.dataDir, 'docs', `${id}.json`);
  let cached;
  try { cached = await readJsonFile(file, 4194304); } catch { /* No matching usable cache. */ }
  if (cached && !refresh) return { status: 'cached', file, source: url, fetchedAt: cached.fetchedAt, freshness: 'cached_not_live' };
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Accept: 'text/plain, application/yaml, application/json, text/markdown' } });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Reference unavailable'); }
    const bytes = await readBounded(response, 2097152);
    const record = { schemaVersion: 1, source: url, endpoint: endpoint.baseUrl, provider: endpoint.provider, fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), etag: response.headers.get('etag'), text: bytes.toString('utf8') };
    await atomicJson(file, record);
    return { status: 'fetched', file, source: url, fetchedAt: record.fetchedAt, sha256: record.sha256, referenceOnly: true };
  } catch {
    return { status: cached ? 'cached' : 'unavailable', ...(cached ? { file, fetchedAt: cached.fetchedAt } : {}), source: url, optional: true, freshness: cached ? 'cached_not_live' : 'unknown' };
  }
}

export async function contentCommand(kind, action, id, context, cli) {
  if (kind === 'docs') {
    if (!['fetch', 'sync'].includes(action)) throw inputError('docs supports fetch or sync');
    return fetchDocs(context, { refresh: action === 'sync' });
  }
  if (kind === 'techniques' && ['prepare', 'check', 'merge'].includes(action)) {
    const { techniqueToolCommand } = await import('./technique-tools.mjs');
    return techniqueToolCommand(action, id, context, cli);
  }
  if (action === 'list') {
    const result = await listContent(kind, context);
    return { ...result, items: result.items.map(({ workflowText, ...entry }) => entry) };
  }
  if (action === 'show') {
    const entry = (await listContent(kind, context)).items.find(item => item.id === id);
    if (!entry) throw inputError('Content ID not found');
    return { status: 'loaded', kind, entry };
  }
  if (action === 'sync') {
    const source = await releaseSource({ ...cli, kind: 'content' });
    if (!cli.yes) return { status: 'prepared', version: source.manifest.version, files: source.manifest.files.length, requires: '--yes', customPreserved: true };
    return syncContent({ kind, source, context });
  }
  throw inputError('Content commands support list, show or sync');
}
