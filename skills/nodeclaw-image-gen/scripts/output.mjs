import { mkdir, writeFile, stat, link, unlink, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readBounded } from './http.mjs';

export async function readJsonFile(file, limit = 67108864) {
  const handle = await open(file, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size > limit) throw new Error('JSON file exceeds byte limit');
    const bytes = Buffer.alloc(Math.min(size + 1, limit + 1));
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > limit) throw new Error('JSON file exceeds byte limit');
    return JSON.parse(bytes.subarray(0, total).toString('utf8'));
  } finally { await handle.close(); }
}

export async function atomicJson(file, value, { exclusive = false } = {}) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
  try {
    if (exclusive) await link(temp, file);
    else {
      const { rename } = await import('node:fs/promises');
      await rename(temp, file);
    }
  } finally { await unlink(temp).catch(() => {}); }
}

function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'gif';
  throw Object.assign(new Error('Returned bytes are not a recognized image format'), { code: 'invalid_image' });
}

async function imageBytes(item, { limit, allowLocalHttp, signal, timeoutMs, fetchImpl }) {
  if (typeof item.b64_json === 'string') {
    if (item.b64_json.length > Math.ceil(limit / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.b64_json)) throw new Error('Invalid or oversized Base64 image');
    const bytes = Buffer.from(item.b64_json, 'base64');
    if (bytes.length > limit) throw new Error('Decoded image exceeds byte limit');
    return bytes;
  }
  if (typeof item.url !== 'string') throw new Error('Image result has neither Base64 nor URL');
  let url = new URL(item.url);
  for (let hop = 0; hop < 5; hop++) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || !['https:', ...(allowLocalHttp && local ? ['http:'] : [])].includes(url.protocol)) throw new Error('Image download requires HTTPS');
    // Image hosts do not inherit API credentials, including across redirects.
    const response = await fetchImpl(url, { redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('Invalid download redirect');
      url = new URL(location, url); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Image download failed (HTTP ${response.status})`); }
    return readBounded(response, limit);
  }
  throw new Error('Too many image download redirects');
}

export async function saveImages(result, outputIntent, { signal, fetchImpl = fetch, stateDir, priorPaths = [], recoveryFile } = {}) {
  if (!Array.isArray(result?.data) || !result.data.length) return { status: 'save_failed', paths: [], error: { code: 'missing_images', message: 'Response contained no image items' } };
  const paths = [...priorPaths]; const failures = []; const items = result.data;
  await mkdir(outputIntent.directory, { recursive: true });
  for (let i = 0; i < items.length; i++) {
    if (paths[i]) {
      const prior = await stat(paths[i]).catch(() => null);
      if (prior?.isFile() && prior.size > 0) continue;
      paths[i] = undefined;
    }
    let temp;
    try {
      const bytes = await imageBytes(items[i], { limit: outputIntent.maxBytes, allowLocalHttp: outputIntent.allowLocalHttp, signal, timeoutMs: outputIntent.timeoutMs, fetchImpl });
      const format = imageFormat(bytes);
      let target;
      if (outputIntent.filename) {
        const parsed = path.parse(outputIntent.filename);
        const suffix = items.length > 1 ? `-${i + 1}` : '';
        const ext = parsed.ext.replace('.', '').toLowerCase();
        if (ext && !(ext === format || (ext === 'jpeg' && format === 'jpg'))) throw new Error('Output extension differs from actual returned image format');
        target = path.join(parsed.dir, `${parsed.name}${suffix}.${ext || format}`);
      } else target = path.join(outputIntent.directory, `image-${randomUUID()}-${i + 1}.${format}`);
      await mkdir(path.dirname(target), { recursive: true });
      temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
      await link(temp, target); // Atomic no-clobber publication, including concurrent clients.
      paths[i] = target;
    } catch (error) {
      failures.push({ index: i, code: error.code === 'EEXIST' ? 'output_exists' : 'image_save_failed', message: error.code === 'EEXIST' ? 'Output already exists; choose another filename' : 'Image could not be downloaded or saved; retry the same result' });
    } finally { if (temp) await unlink(temp).catch(() => {}); }
  }
  const saved = paths.filter(Boolean);
  if (!failures.length) return { status: 'saved', paths: saved, actualCount: items.length };
  let handle = recoveryFile;
  if (stateDir) {
    handle ||= path.join(stateDir, 'results', `${randomUUID()}.json`);
    await atomicJson(handle, { schemaVersion: 1, kind: 'image-result', result: { data: items.map(({ b64_json, url }) => ({ ...(b64_json ? { b64_json } : {}), ...(url ? { url } : {}) })) }, outputIntent, paths });
  }
  return { status: 'save_failed', paths: saved, actualCount: items.length, failures, ...(handle ? { handle } : {}) };
}
