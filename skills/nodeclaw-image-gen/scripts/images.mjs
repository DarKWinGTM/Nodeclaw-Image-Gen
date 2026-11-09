import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { apiUrl, inputError } from './config.mjs';
import { discoverModels } from './models.mjs';
import { authorization, readBounded } from './http.mjs';
import { saveImages } from './output.mjs';

export async function planImageRequest(context, spec = {}, { env = context.env || process.env } = {}) {
  const apiMode = spec.apiMode || context.config.apiMode || 'images';
  if (!['images', 'gemini'].includes(apiMode)) throw inputError('apiMode must be images or gemini');
  const operation = spec.operation || 'image_generation';
  if (!['image_generation', 'image_edit'].includes(operation)) throw inputError('Unsupported image operation');
  const raw = spec.request || {};
  const model = spec.model || raw.model || context.config.model;
  if (apiMode === 'gemini' && (typeof model !== 'string' || !model.trim() || /[\\/\x00-\x20\x7f]/.test(model))) throw inputError('Native Gemini model must be an exact public model ID without a slash or whitespace');
  let endpoint = context.endpoints[0]; let modelInfo; let discoveryStatus = 'capability_unknown';
  if (!spec.skipDiscovery && apiMode !== 'gemini') {
    for (const candidate of context.endpoints) {
      const view = await discoverModels(candidate, { env, timeoutMs: Math.min(15000, context.config.timeouts.requestMs) });
      const found = view.models.find(m => m.id === model);
      endpoint = candidate; modelInfo = found; discoveryStatus = found ? 'listed' : view.status === 'listed' ? 'not_listed' : view.status;
      // Neither a Chat-only list nor unavailable discovery can exclude an image model.
      if (!found || !found.pairs.length || found.pairs.some(p => p.operation === operation)) break;
      if (candidate === context.endpoints.at(-1)) throw inputError('Catalog declares this model without the requested image operation');
    }
  }
  const pairs = modelInfo?.pairs.filter(p => p.operation === operation) || [];
  const payload = { ...raw, model };
  if (spec.prompt !== undefined) payload.prompt = spec.prompt;
  if (!payload.prompt && !payload.contents) throw inputError('Provide --prompt, a spec prompt, or native request contents');
  if (typeof payload.prompt !== 'undefined' && typeof payload.prompt !== 'string') throw inputError('prompt must be a string');
  const controls = { n: spec.n ?? context.config.image.count, size: spec.size ?? context.config.image.size,
    quality: spec.quality ?? context.config.image.quality, output_format: spec.format ?? context.config.image.format,
    response_format: spec.responseFormat };
  for (const [key, value] of Object.entries(controls)) {
    if (value !== undefined && value !== 'auto' && raw[key] === undefined) payload[key] = key === 'n' ? Number(value) : value;
  }
  if (payload.n !== undefined && (!Number.isSafeInteger(payload.n) || payload.n < 1)) throw inputError('n must be a positive integer');
  if (endpoint.provider === 'nodeclaw' && apiMode === 'images') {
    const explicit = spec.compatibilityKey || context.config.compatibilityKey || raw.compatibilityKey;
    if (explicit && pairs.length && !pairs.some(p => p.compatibilityKey === explicit)) throw inputError('compatibilityKey disagrees with this operation catalog');
    payload.compatibilityKey = explicit || pairs[0]?.compatibilityKey || (operation === 'image_edit' ? 'openai_image_edits' : 'openai_image_generations');
  } else if (raw.compatibilityKey !== undefined) throw inputError('compatibilityKey belongs to Images mode, not the selected native/custom wire');
  if (payload.compatibilityKey === 'google_image_generate_content' && raw.n === undefined && spec.n === undefined) delete payload.n;
  const files = [];
  const inputs = spec.image === undefined ? [] : Array.isArray(spec.image) ? spec.image : [spec.image];
  if (inputs.some(value => typeof value !== 'string')) throw inputError('image inputs must be selected file paths');
  for (const filename of inputs) files.push({ field: (inputs.length > 1 ? 'image[]' : 'image'), filename: path.resolve(context.cwd, filename) });
  if (spec.mask) files.push({ field: 'mask', filename: path.resolve(context.cwd, spec.mask) });
  if (spec.referenceUrl) {
    const url = new URL(spec.referenceUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw inputError('Reference URL must use HTTPS without embedded credentials');
    payload.image = spec.referenceUrl;
  }
  if (operation === 'image_edit' && !files.some(f => f.field.startsWith('image')) && !payload.image && !payload.images && !payload.contents) throw inputError('Edit needs an explicitly selected source image or native image content');
  let fileBytes = 0;
  for (const file of files) {
    const info = await stat(file.filename);
    if (!info.isFile()) throw inputError('Edit input must be a regular file');
    fileBytes += info.size;
    if (fileBytes > 34 * 1024 * 1024) throw inputError('Local edit input exceeds the configured 34 MiB client limit');
  }
  if (apiMode === 'gemini') {
    for (const key of ['n', 'size', 'quality', 'format', 'responseFormat', 'compatibilityKey']) {
      if (spec[key] !== undefined) throw inputError('Native Gemini uses contents/generationConfig rather than Images controls');
    }
    if (spec.mask || spec.referenceUrl) throw inputError('Native Gemini mask/reference controls must be provided as supported native parts');
    if (raw.prompt !== undefined || ['n', 'size', 'quality', 'output_format', 'response_format', 'stream', 'partial_images', 'image', 'images'].some(key => raw[key] !== undefined)) {
      throw inputError('Native Gemini request JSON must use contents/parts and generationConfig');
    }
    if (raw.contents && spec.prompt !== undefined) throw inputError('Choose native contents or --prompt, not both');
    delete payload.model; delete payload.prompt;
    for (const key of ['n', 'size', 'quality', 'output_format', 'response_format']) delete payload[key];
    payload.contents = raw.contents || [{ role: 'user', parts: [{ text: spec.prompt }] }];
    if (!Array.isArray(payload.contents) || !payload.contents.length || payload.contents.some(item => !Array.isArray(item?.parts) || !item.parts.length)) throw inputError('Native Gemini needs nonempty contents with parts');
    if (raw.generationConfig != null && (typeof raw.generationConfig !== 'object' || Array.isArray(raw.generationConfig))) throw inputError('generationConfig must be an object');
    payload.generationConfig = { responseModalities: ['IMAGE'], ...raw.generationConfig };
  }
  const requestedMethod = spec.method || context.config.method;
  let method = requestedMethod; let fallbackReason;
  if (method === 'task' && (!endpoint.taskSupported || apiMode === 'gemini')) {
    if (!context.config.fallback.enabled) throw inputError('Selected custom profile is Direct-only; select direct or enable safe fallback');
    method = 'direct'; fallbackReason = 'profile_direct_only';
  }
  if (payload.stream === true && method === 'task') throw inputError('Task requires stream=false');
  if (Number(payload.partial_images || 0) > 0 && method === 'task') throw inputError('Task cannot request partial images');
  if (apiMode === 'images') payload.stream = false;
  if (method === 'task') payload.partial_images = 0;
  const filename = spec.output ? path.resolve(context.cwd, spec.output) : undefined;
  return { context, endpoint, operation, model, apiMode, payload, files, method, requestedMethod, fallbackReason, discoveryStatus,
    outputIntent: { directory: filename ? path.dirname(filename) : context.config.outputDir, filename,
      maxBytes: context.config.maxResponseBytes, timeoutMs: context.config.timeouts.requestMs, allowLocalHttp: context.config.allowLocalHttp } };
}

export function describePlan(plan) {
  return { operation: plan.operation, model: plan.model, endpoint: plan.endpoint.baseUrl, endpointSource: plan.endpoint.source,
    apiMode: plan.apiMode, requestedMethod: plan.requestedMethod, actualMethod: plan.method, fallbackReason: plan.fallbackReason,
    modelStatus: plan.discoveryStatus, compatibilityKey: plan.payload.compatibilityKey,
    output: plan.outputIntent.filename || plan.outputIntent.directory, imageCount: plan.payload.n,
    inputFiles: plan.files.map(f => path.basename(f.filename)), fallback: plan.context.config.fallback };
}

export async function encodeRequest(plan, task = false) {
  const payload = { ...plan.payload };
  if (task) { payload.stream = false; payload.partial_images = 0; }
  let body; let headers;
  if (plan.apiMode === 'gemini') {
    if (task) throw inputError('Native Gemini has no Task wire; use the Images mode for Task execution');
    if (plan.files.length) {
      const parts = [];
      for (const file of plan.files) {
        const mimeType = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file.filename).toLowerCase()];
        if (!mimeType) throw inputError('Native Gemini local inputs must be PNG, JPEG or WebP');
        const info = await stat(file.filename);
        if (!info.isFile() || info.size > 34 * 1024 * 1024) throw inputError('Native image input exceeds client byte limit');
        parts.push({ inlineData: { mimeType, data: (await readFile(file.filename)).toString('base64') } });
      }
      payload.contents = [...payload.contents.slice(0, -1), { ...payload.contents.at(-1), parts: [...payload.contents.at(-1).parts, ...parts] }];
    }
    body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > (plan.endpoint.provider === 'nodeclaw' ? 2 : 34) * 1024 * 1024) throw inputError('Encoded native Gemini request exceeds the selected byte limit');
    headers = { 'Content-Type': 'application/json' };
  } else if (plan.files.length) {
    const form = new FormData();
    if (task) form.append('operation', plan.operation);
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    for (const file of plan.files) {
      const info = await stat(file.filename);
      if (info.size > 34 * 1024 * 1024) throw inputError('Edit input exceeds client byte limit');
      const bytes = await readFile(file.filename);
      const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file.filename).toLowerCase()] || 'application/octet-stream';
      form.append(file.field, new Blob([bytes], { type: mime }), path.basename(file.filename));
    }
    const encoded = new Request('https://encode.invalid', { method: 'POST', body: form });
    headers = { 'Content-Type': encoded.headers.get('content-type') };
    body = Buffer.from(await encoded.arrayBuffer());
    if (body.length > 34 * 1024 * 1024) throw inputError('Encoded Edit multipart exceeds 34 MiB');
  } else {
    const nested = JSON.stringify(payload);
    const limit = plan.endpoint.provider === 'nodeclaw' && plan.operation === 'image_generation' ? 2 * 1024 * 1024 : 34 * 1024 * 1024;
    if (Buffer.byteLength(nested) > limit) throw inputError('Encoded image request exceeds the selected operation byte limit');
    body = task ? JSON.stringify({ operation: plan.operation, request: payload }) : nested;
    headers = { 'Content-Type': 'application/json' };
  }
  return { body, headers };
}

export function safeApiError(data, status) {
  const code = typeof data?.error?.code === 'string' && /^[a-z0-9_:-]{1,80}$/i.test(data.error.code) ? data.error.code : `http_${status}`;
  return { code, message: `API request failed (${code}, HTTP ${status})` };
}

function parseImageResponse(bytes, contentType, operation) {
  if (!contentType.includes('text/event-stream')) return JSON.parse(bytes.toString('utf8'));
  let completed;
  const records = bytes.toString('utf8').replace(/\r\n/g, '\n').split('\n\n');
  records.pop(); // A trailing partial record is not a completed SSE event.
  for (const record of records) {
    const lines = record.split('\n');
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const text = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!text || text === '[DONE]') continue;
    let data; try { data = JSON.parse(text); } catch { continue; }
    const type = data.type || event;
    if (type === `${operation}.completed` && (!event || event === type)) {
      if (completed) throw new Error('Duplicate completion event');
      completed = Array.isArray(data.data) ? data : { data: [{ ...(data.b64_json ? { b64_json: data.b64_json } : {}), ...(data.url ? { url: data.url } : {}) }] };
    }
  }
  if (!completed?.data?.some(i => i.b64_json || i.url)) throw new Error('No complete image event received');
  return completed;
}

export async function executeDirect(plan, { signal, env = plan.context.env || process.env, fetchImpl = fetch } = {}) {
  const encoded = await encodeRequest(plan);
  const auth = authorization(plan.endpoint, env);
  const summary = describePlan(plan);
  let response;
  try {
    const url = plan.apiMode === 'gemini'
      ? apiUrl(plan.endpoint, `models/${encodeURIComponent(plan.model)}:generateContent`, 'v1beta')
      : apiUrl(plan.endpoint, plan.operation === 'image_edit' ? 'images/edits' : 'images/generations');
    response = await fetchImpl(url, {
      method: 'POST', body: encoded.body, headers: { ...auth, ...encoded.headers, Accept: 'application/json' }, redirect: 'manual',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(plan.context.config.timeouts.requestMs)]) : AbortSignal.timeout(plan.context.config.timeouts.requestMs),
    });
    const bytes = await readBounded(response, plan.context.config.maxResponseBytes);
    if (!response.ok) {
      let data; try { data = JSON.parse(bytes); } catch { data = {}; }
      const unknown = response.status >= 500 || response.status >= 300 && response.status < 400;
      return { ...summary, status: unknown ? 'outcome_unknown' : 'failed', error: safeApiError(data, response.status) };
    }
    let result;
    if (plan.apiMode === 'gemini') {
      const native = JSON.parse(bytes.toString('utf8'));
      const data = [];
      for (const candidate of Array.isArray(native.candidates) ? native.candidates : []) {
        if (candidate.finishReason && candidate.finishReason !== 'STOP') continue;
        for (const part of Array.isArray(candidate.content?.parts) ? candidate.content.parts : []) {
          const image = part.inlineData || part.inline_data;
          if (image && ['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType || image.mime_type) && typeof image.data === 'string' && image.data.length) data.push({ b64_json: image.data });
        }
      }
      result = { data };
    } else result = parseImageResponse(bytes, response.headers.get('content-type') || '', plan.operation);
    return { ...summary, ...await saveImages(result, plan.outputIntent, { signal, fetchImpl, stateDir: plan.context.stateDir }) };
  } catch {
    return { ...summary, status: 'outcome_unknown', error: { code: 'direct_outcome_unknown', message: 'Direct completion could not be established; no request was replayed' } };
  }
}
