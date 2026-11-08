import { open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const DEFAULTS = {
  schemaVersion: 1, provider: 'auto', model: 'gpt-image-2', method: 'task',
  timeouts: { requestMs: 300000, waitMs: 900000, pollIntervalMs: 2000 },
  apiBaseUrl: null, catalogUrl: null, apiDocsUrl: null, apiKeyEnv: 'NODECLAW_API_KEY',
  fallback: { enabled: true, onTerminalFailure: false }, outputDir: './generated-images',
  image: { count: 1, size: 'auto', quality: 'auto', format: 'auto' },
  wizard: { mode: 'compact', confirmBeforeGenerate: true },
  styles: { suggest: true, search: 'on_request' }, updates: { channel: 'stable', applyAutomatically: false },
  allowLocalHttp: false, maxResponseBytes: 67108864,
};
export const NATIVE_URL = 'https://payg.nodenetwork.ovh';
export const NATIVE_CATALOG = 'https://app.nodenetwork.ovh/api/payg-model-data';
export const NATIVE_DOCS = 'https://nodenetwork.ovh/docs/api/payg/openapi/payg-gateway.v1.yaml';

export function inputError(message) {
  return Object.assign(new Error(message), { code: 'invalid_input', exitCode: 2 });
}

export function parseBoolean(value, name) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw inputError(`${name} must be true/false/1/0`);
}

export function validateUrl(value, { allowLocalHttp = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw inputError('Invalid URL; specify an absolute HTTPS URL'); }
  if (url.username || url.password || url.search || url.hash) throw inputError('Endpoint URLs cannot contain credentials, queries or fragments');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && allowLocalHttp)) {
    throw inputError('Use HTTPS; loopback HTTP requires allowLocalHttp or --allow-local-http');
  }
  return url.href.replace(/\/$/, '');
}

export function apiUrl(endpoint, route) {
  const base = endpoint.baseUrl.replace(/\/+$/, '');
  return `${base}${/\/v1$/.test(base) ? '' : '/v1'}/${route.replace(/^\/+/, '')}`;
}

function mergeConfig(base, override) {
  const result = { ...base, ...override };
  for (const key of ['timeouts', 'fallback', 'image', 'wizard', 'styles', 'updates']) {
    if (override[key] != null && (typeof override[key] !== 'object' || Array.isArray(override[key]))) throw inputError(`${key} must be an object`);
    result[key] = { ...base[key], ...override[key] };
  }
  return result;
}

export function userDirectories({ platform = process.platform, homeDir = os.homedir(), env = process.env } = {}) {
  if (!homeDir) throw inputError('Home directory unavailable; specify --config');
  if (platform === 'win32') {
    const base = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    const configDir = path.join(base, 'Nodeclaw-Image-Gen');
    return { configDir, stateDir: path.join(configDir, 'state'), dataDir: path.join(configDir, 'data') };
  }
  if (platform === 'darwin') {
    const base = path.join(homeDir, 'Library', 'Application Support', 'Nodeclaw-Image-Gen');
    return { configDir: base, stateDir: path.join(base, 'state'), dataDir: path.join(base, 'data') };
  }
  return {
    configDir: path.join(env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'nodeclaw-image-gen'),
    stateDir: path.join(env.XDG_STATE_HOME || path.join(homeDir, '.local', 'state'), 'nodeclaw-image-gen'),
    dataDir: path.join(env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), 'nodeclaw-image-gen'),
  };
}

export async function resolveContext({ cli = {}, env = process.env, cwd = process.cwd(), platform = process.platform, homeDir = os.homedir() } = {}) {
  const dirs = userDirectories({ platform, homeDir, env });
  const configPath = path.resolve(cwd, cli.config || env.NODECLAW_IMAGE_GEN_CONFIG || path.join(dirs.configDir, 'config.json'));
  let saved = {};
  try {
    const file = await open(configPath, 'r');
    try {
      if ((await file.stat()).size > 65536) throw inputError('Config exceeds 64 KiB');
      const buffer = Buffer.alloc(65537);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 65536) throw inputError('Config exceeds 64 KiB');
      saved = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
    } finally { await file.close(); }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw inputError('Config must be a JSON object');
  } catch (error) {
    if (error.code !== 'ENOENT') throw inputError(`Cannot load config: ${error instanceof SyntaxError ? 'invalid JSON' : error.message}`);
    if ((cli.config || env.NODECLAW_IMAGE_GEN_CONFIG) && cli.command !== 'setup') throw inputError('Selected config does not exist; run setup with that path');
  }
  let config = mergeConfig(DEFAULTS, saved);
  const fields = { API: 'apiBaseUrl', MODEL: 'model', METHOD: 'method', CATALOG_URL: 'catalogUrl', DOCS_URL: 'apiDocsUrl', OUTPUT_DIR: 'outputDir', API_KEY_ENV: 'apiKeyEnv' };
  for (const [suffix, key] of Object.entries(fields)) {
    if (env[`NODECLAW_IMAGE_GEN_${suffix}`] !== undefined) config[key] = env[`NODECLAW_IMAGE_GEN_${suffix}`];
  }
  for (const [suffix, key] of [['FALLBACK', 'enabled'], ['FALLBACK_TERMINAL', 'onTerminalFailure']]) {
    if (env[`NODECLAW_IMAGE_GEN_${suffix}`] !== undefined) config.fallback[key] = parseBoolean(env[`NODECLAW_IMAGE_GEN_${suffix}`], `NODECLAW_IMAGE_GEN_${suffix}`);
  }
  const overrides = {};
  for (const key of ['provider', 'model', 'method', 'apiBaseUrl', 'catalogUrl', 'apiDocsUrl', 'apiKeyEnv', 'outputDir', 'allowLocalHttp', 'maxResponseBytes', 'compatibilityKey']) {
    if (cli[key] !== undefined) overrides[key] = cli[key];
  }
  config = mergeConfig(config, overrides);
  for (const [key, cliKey] of [['enabled', 'fallback'], ['onTerminalFailure', 'fallbackTerminal']]) {
    if (cli[cliKey] !== undefined) config.fallback[key] = parseBoolean(cli[cliKey], cliKey);
    else config.fallback[key] = parseBoolean(config.fallback[key], `fallback.${key}`);
  }
  for (const key of ['requestMs', 'waitMs', 'pollIntervalMs']) {
    if (cli[key] !== undefined) config.timeouts[key] = Number(cli[key]);
    if (!Number.isSafeInteger(config.timeouts[key]) || config.timeouts[key] < 1) throw inputError(`timeouts.${key} must be a positive integer`);
  }
  if (config.schemaVersion !== 1) throw inputError('Unsupported config schemaVersion');
  if (!['auto', 'nodeclaw', 'openai-compatible'].includes(config.provider)) throw inputError('provider must be auto, nodeclaw or openai-compatible');
  if (!['task', 'direct'].includes(config.method)) throw inputError('method must be task or direct');
  if (typeof config.model !== 'string' || !config.model.trim()) throw inputError('model must be a nonblank exact ID');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.apiKeyEnv)) throw inputError('apiKeyEnv must name an environment variable, not contain a key');
  config.allowLocalHttp = parseBoolean(config.allowLocalHttp, 'allowLocalHttp');
  if (!Number.isSafeInteger(Number(config.maxResponseBytes)) || Number(config.maxResponseBytes) < 1024) throw inputError('maxResponseBytes must be an integer >= 1024');
  config.maxResponseBytes = Number(config.maxResponseBytes);
  config.outputDir = path.resolve(cwd, config.outputDir);
  const endpoints = [];
  function add(baseUrl, source, apiKeyEnv, requestedProvider, extras = {}) {
    baseUrl = validateUrl(baseUrl, config);
    if (endpoints.some(e => e.baseUrl === baseUrl)) return;
    const host = new URL(baseUrl).hostname;
    const nativeHost = host === 'nodenetwork.ovh' || host.endsWith('.nodenetwork.ovh');
    const provider = requestedProvider === 'auto' ? (nativeHost ? 'nodeclaw' : 'openai-compatible') : requestedProvider;
    endpoints.push({ baseUrl, source, apiKeyEnv, provider,
      catalogUrl: extras.catalogUrl ? validateUrl(extras.catalogUrl, config) : baseUrl === NATIVE_URL ? NATIVE_CATALOG : null,
      apiDocsUrl: extras.apiDocsUrl ? validateUrl(extras.apiDocsUrl, config) : baseUrl === NATIVE_URL ? NATIVE_DOCS : null,
      allowLocalHttp: config.allowLocalHttp, taskSupported: provider === 'nodeclaw',
    });
  }
  const explicit = cli.apiBaseUrl !== undefined;
  if (!explicit && !['setup', 'styles', 'techniques', 'update'].includes(cli.command)) {
    if (cli.harnessEndpoint) add(cli.harnessEndpoint, 'harness', cli.harnessApiKeyEnv || config.apiKeyEnv, cli.harnessProvider || 'auto');
    else if ((cli.harness === 'claude-code' || env.CLAUDECODE === '1') && env.ANTHROPIC_BASE_URL) {
      add(env.ANTHROPIC_BASE_URL, 'harness', env.ANTHROPIC_AUTH_TOKEN ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY', 'auto');
    }
  }
  if (config.apiBaseUrl) add(config.apiBaseUrl, explicit ? 'configured-pin' : 'configured', config.apiKeyEnv, config.provider, config);
  if (!explicit) add(NATIVE_URL, 'native', config.apiBaseUrl ? 'NODECLAW_API_KEY' : config.apiKeyEnv, 'nodeclaw', config.apiBaseUrl ? {} : config);
  if (!endpoints.length) add(NATIVE_URL, 'native', 'NODECLAW_API_KEY', 'nodeclaw', config);
  return { config, configPath, configExists: Object.keys(saved).length > 0, cwd, ...dirs, endpoints };
}
