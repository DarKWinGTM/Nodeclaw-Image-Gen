import { inputError } from './config.mjs';

export async function readBounded(response, limit) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) {
    await response.body?.cancel();
    throw Object.assign(new Error('Response exceeds configured byte limit'), { code: 'response_too_large' });
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Object.assign(new Error('Response exceeds configured byte limit'), { code: 'response_too_large' });
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally { reader.releaseLock(); }
}

export function authorization(endpoint, env = process.env, { required = true } = {}) {
  const key = endpoint.apiKey || (endpoint.apiKeyEnv && env[endpoint.apiKeyEnv]);
  if (!key && required) throw inputError('API key is missing; use local setup --interactive, native plugin configuration, or the configured key environment variable');
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export async function requestJson(url, { endpoint, env, method = 'GET', body, headers = {}, signal, timeoutMs = 30000, limit = 2097152, fetchImpl = fetch, authenticated = false } = {}) {
  const response = await fetchImpl(url, {
    method, body, redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', ...(authenticated ? authorization(endpoint, env) : {}), ...headers },
  });
  const bytes = await readBounded(response, limit);
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); }
  catch { throw Object.assign(new Error('Response was not valid JSON'), { code: 'invalid_response', httpStatus: response.status }); }
  if (!response.ok) {
    // Never surface arbitrary provider bodies: they can echo prompts or credentials.
    const code = typeof data?.error?.code === 'string' && /^[a-z0-9_:-]{1,80}$/i.test(data.error.code) ? data.error.code : `http_${response.status}`;
    throw Object.assign(new Error(`API request failed (${code}, HTTP ${response.status})`), { code, httpStatus: response.status, retryAfter: response.headers.get('retry-after') });
  }
  return { data, response };
}

export function retryDelay(value, baselineMs = 2000, now = Date.now()) {
  if (value == null) return baselineMs;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.max(seconds, baselineMs) : baselineMs;
}
