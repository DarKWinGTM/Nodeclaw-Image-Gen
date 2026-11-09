import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export const DEFAULTS = {
  schemaVersion: 1, provider: 'auto', model: 'gpt-image-2', method: 'task',
  timeouts: { requestMs: 300000, waitMs: 900000, pollIntervalMs: 2000 },
  apiBaseUrl: null, catalogUrl: null, apiDocsUrl: null, apiKeyEnv: 'NODECLAW_API_KEY',
  endpointMode: 'auto', apiMode: 'images',
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

export function apiUrl(endpoint, route, version = 'v1') {
  const base = endpoint.baseUrl.replace(/\/+$/, '').replace(/\/v1(?:beta)?$/, '');
  return `${base}/${version}/${route.replace(/^\/+/, '')}`;
}

function validateApiKey(value) {
  if (value == null) return;
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > 4096 || /[^\x21-\x7e]/u.test(value)) {
    throw inputError('API key must be a nonempty header-safe value of at most 4096 bytes');
  }
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
  let saved = {}; let configExists = false;
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
    configExists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw inputError(`Cannot load config: ${error instanceof SyntaxError ? 'invalid JSON' : error.message}`);
    if ((cli.config || env.NODECLAW_IMAGE_GEN_CONFIG) && cli.command !== 'setup') throw inputError('Selected config does not exist; run setup with that path');
  }
  const { apiKey: savedKey, ...savedSettings } = saved;
  validateApiKey(savedKey);
  if (cli.apiKey !== undefined && cli.command !== 'setup') throw inputError('API key arguments are setup-only; use private config for requests');
  validateApiKey(cli.apiKey);
  let config = mergeConfig(DEFAULTS, savedSettings);
  const fields = { API: 'apiBaseUrl', MODEL: 'model', METHOD: 'method', CATALOG_URL: 'catalogUrl', DOCS_URL: 'apiDocsUrl', OUTPUT_DIR: 'outputDir', API_KEY_ENV: 'apiKeyEnv', ENDPOINT_MODE: 'endpointMode', API_MODE: 'apiMode' };
  for (const [suffix, key] of Object.entries(fields)) {
    if (env[`NODECLAW_IMAGE_GEN_${suffix}`] !== undefined) config[key] = env[`NODECLAW_IMAGE_GEN_${suffix}`];
  }
  for (const [suffix, key] of [['FALLBACK', 'enabled'], ['FALLBACK_TERMINAL', 'onTerminalFailure']]) {
    if (env[`NODECLAW_IMAGE_GEN_${suffix}`] !== undefined) config.fallback[key] = parseBoolean(env[`NODECLAW_IMAGE_GEN_${suffix}`], `NODECLAW_IMAGE_GEN_${suffix}`);
  }
  const overrides = {};
  for (const key of ['provider', 'model', 'method', 'apiBaseUrl', 'catalogUrl', 'apiDocsUrl', 'apiKeyEnv', 'outputDir', 'allowLocalHttp', 'maxResponseBytes', 'compatibilityKey', 'endpointMode', 'apiMode']) {
    if (cli[key] !== undefined) overrides[key] = cli[key];
  }
  if (cli.command === 'setup' && (cli.apiBaseUrl !== undefined || cli.apiKey !== undefined || cli.apiKeyStdin || cli.interactive) && cli.endpointMode === undefined) overrides.endpointMode = 'configured';
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
  if (!['auto', 'configured'].includes(config.endpointMode)) throw inputError('endpointMode must be auto or configured');
  if (!['images', 'gemini'].includes(config.apiMode)) throw inputError('apiMode must be images or gemini');
  if (typeof config.model !== 'string' || !config.model.trim()) throw inputError('model must be a nonblank exact ID');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.apiKeyEnv)) throw inputError('apiKeyEnv must name an environment variable, not contain a key');
  config.allowLocalHttp = parseBoolean(config.allowLocalHttp, 'allowLocalHttp');
  if (!Number.isSafeInteger(Number(config.maxResponseBytes)) || Number(config.maxResponseBytes) < 1024) throw inputError('maxResponseBytes must be an integer >= 1024');
  config.maxResponseBytes = Number(config.maxResponseBytes);
  config.outputDir = path.resolve(cwd, config.outputDir);
  const savedBase = validateUrl(savedSettings.apiBaseUrl || NATIVE_URL, config);
  const selectedBase = validateUrl(config.apiBaseUrl || NATIVE_URL, config);
  let scopedBase;
  if (env.NODECLAW_IMAGE_GEN_API_KEY !== undefined) {
    validateApiKey(env.NODECLAW_IMAGE_GEN_API_KEY);
    if (!env.NODECLAW_IMAGE_GEN_API) throw inputError('NODECLAW_IMAGE_GEN_API_KEY requires its matching NODECLAW_IMAGE_GEN_API address');
    scopedBase = validateUrl(env.NODECLAW_IMAGE_GEN_API, config);
  }
  const endpoints = [];
  function add(baseUrl, source, apiKeyEnv, requestedProvider, extras = {}, key) {
    baseUrl = validateUrl(baseUrl, config);
    if (endpoints.some(e => e.baseUrl === baseUrl)) return;
    const host = new URL(baseUrl).hostname;
    const nativeHost = host === 'nodenetwork.ovh' || host.endsWith('.nodenetwork.ovh');
    const provider = requestedProvider === 'auto' ? (nativeHost ? 'nodeclaw' : 'openai-compatible') : requestedProvider;
    const endpoint = { baseUrl, source, apiKeyEnv, provider,
      catalogUrl: extras.catalogUrl ? validateUrl(extras.catalogUrl, config) : baseUrl === NATIVE_URL ? NATIVE_CATALOG : null,
      apiDocsUrl: extras.apiDocsUrl ? validateUrl(extras.apiDocsUrl, config) : baseUrl === NATIVE_URL ? NATIVE_DOCS : null,
      allowLocalHttp: config.allowLocalHttp, taskSupported: provider === 'nodeclaw',
    };
    // Task handles serialize endpoints; credentials must never become saved fields.
    if (key) Object.defineProperty(endpoint, 'apiKey', { value: key });
    endpoints.push(endpoint);
  }
  const explicit = cli.apiBaseUrl !== undefined || config.endpointMode === 'configured';
  if (!explicit && (cli.status || !['setup', 'styles', 'techniques', 'update'].includes(cli.command))) {
    if (cli.harnessEndpoint) add(cli.harnessEndpoint, 'harness', cli.harnessApiKeyEnv || config.apiKeyEnv, cli.harnessProvider || 'auto');
    else if ((cli.harness === 'claude-code' || env.CLAUDECODE === '1') && env.ANTHROPIC_BASE_URL) {
      add(env.ANTHROPIC_BASE_URL, 'harness', env.ANTHROPIC_AUTH_TOKEN ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY', 'auto');
    }
  }
  const selectedKey = cli.apiKey ?? (scopedBase === selectedBase ? env.NODECLAW_IMAGE_GEN_API_KEY : undefined) ?? (savedBase === selectedBase ? savedKey : undefined);
  if (config.apiBaseUrl || explicit) add(selectedBase, explicit ? 'configured-pin' : 'configured', config.apiKeyEnv, config.provider, config, selectedKey);
  if (!explicit) add(NATIVE_URL, 'native', config.apiBaseUrl ? 'NODECLAW_API_KEY' : config.apiKeyEnv, 'nodeclaw', config.apiBaseUrl ? {} : config, config.apiBaseUrl ? undefined : selectedKey);
  const context = { config, configPath, configExists, cwd, ...dirs, endpoints };
  Object.defineProperty(context, 'savedConfig', { value: saved });
  return context;
}

export async function writePluginEnvironment(env = process.env) {
  const apiKey = env.CLAUDE_PLUGIN_OPTION_API_KEY;
  validateApiKey(apiKey);
  if (!apiKey) throw inputError('Configure the plugin API key with /plugin configure nodeclaw-image-gen, then start a new session');
  const baseUrl = validateUrl(env.CLAUDE_PLUGIN_OPTION_API_BASE_URL || NATIVE_URL);
  const destination = env.CLAUDE_ENV_FILE;
  if (!destination || !path.isAbsolute(destination)) throw inputError('Native configuration bridge needs CLAUDE_ENV_FILE in a supported session; use local setup --interactive otherwise');
  const prior = await lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (prior && !prior.isFile()) throw inputError('Session environment target must be an ordinary file');
  const file = await open(destination, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0), 0o600);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || prior && (prior.dev !== info.dev || prior.ino !== info.ino)) throw inputError('Session environment target changed or has unsafe ownership');
    if (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid())) throw inputError('Session environment file must be owner-only; permissions were not changed');
    const quote = value => `"${value.replace(/[\\"$`]/g, '\\$&')}"`;
    // Literal assignments only: a key cannot become shell code when Bash loads this file.
    await file.appendFile(`\nexport NODECLAW_IMAGE_GEN_API=${quote(baseUrl)}\nexport NODECLAW_IMAGE_GEN_API_KEY=${quote(apiKey)}\nexport NODECLAW_IMAGE_GEN_ENDPOINT_MODE=configured\n`);
  } finally { await file.close(); }
}

export async function readSetupInput(cli, { input = process.stdin, output = process.stderr } = {}) {
  const sources = [cli.apiKey !== undefined, cli.apiKeyStdin, cli.interactive].filter(Boolean).length;
  if (sources > 1) throw inputError('Choose only one API key input: argument, stdin, or interactive');
  if (cli.apiKeyStdin) {
    const chunks = []; let length = 0;
    for await (const chunk of input) {
      length += Buffer.byteLength(chunk);
      if (length > 4098) throw inputError('API key input exceeds 4096 bytes');
      chunks.push(Buffer.from(chunk));
    }
    const apiKey = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
    validateApiKey(apiKey);
    return { ...cli, apiKey };
  }
  if (!cli.interactive) return cli;
  if (!input.isTTY || !output.isTTY) throw inputError('Interactive setup needs a local terminal; use --api-key-stdin for a secure pipe');
  let hidden = false;
  const terminal = new Writable({ write(chunk, encoding, done) {
    if (hidden) done(); else output.write(chunk, encoding, done);
  } });
  const controller = new AbortController();
  const rl = createInterface({ input, output: terminal, terminal: true, historySize: 0 });
  rl.on('SIGINT', () => controller.abort());
  rl.on('close', () => controller.abort());
  try {
    const defaultAddress = cli.apiBaseUrl || NATIVE_URL;
    const address = await rl.question(`API base address [${defaultAddress}]: `, { signal: controller.signal });
    output.write('API key (hidden; saved in private local config): ');
    hidden = true;
    const apiKey = await rl.question('', { signal: controller.signal });
    validateApiKey(apiKey);
    return { ...cli, apiBaseUrl: address.trim() || defaultAddress, apiKey };
  } catch (error) {
    if (controller.signal.aborted) throw inputError('Configuration entry cancelled; no settings were saved');
    throw error;
  } finally {
    if (hidden) output.write('\n');
    rl.close();
    terminal.end();
  }
}

export async function saveConfiguration(context, cli = {}, { preview = false } = {}) {
  const existing = await lstat(context.configPath).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existing && !existing.isFile()) throw inputError('Config target must be an ordinary file, not a symlink or directory');
  if (existing && !cli.replace && !preview) throw inputError('Existing config requires explicit --replace confirmation');
  const base = validateUrl(context.config.apiBaseUrl || NATIVE_URL, context.config);
  const oldBase = validateUrl(context.savedConfig.apiBaseUrl || NATIVE_URL, context.config);
  const selected = { ...context.config, outputDir: cli.outputDir ?? context.savedConfig.outputDir ?? DEFAULTS.outputDir };
  const apiKey = cli.apiKey ?? (base === oldBase ? context.savedConfig.apiKey : undefined);
  if (apiKey) selected.apiKey = apiKey;
  if (!preview) {
    const { atomicJson } = await import('./output.mjs');
    await atomicJson(context.configPath, selected, { exclusive: !existing });
  }
  const { authorization } = await import('./http.mjs');
  return { status: preview ? 'prepared' : 'configured', configPath: context.configPath, apiBaseUrl: base, endpointMode: selected.endpointMode,
    apiMode: selected.apiMode, credentialConfigured: Boolean(authorization(context.endpoints[0], process.env, { required: false }).Authorization), apiKeyEnv: selected.apiKeyEnv,
    ...(preview && existing ? { replacementRequired: true } : {}) };
}
