import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveContext, apiUrl, readSetupInput } from '../skills/nodeclaw-image-gen/scripts/config.mjs';
import { PassThrough, Writable } from 'node:stream';
import { discoverModels } from '../skills/nodeclaw-image-gen/scripts/models.mjs';
import { authorization } from '../skills/nodeclaw-image-gen/scripts/http.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('setup saves endpoint-bound private credentials and updates only with explicit replacement', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-private-config-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'private', 'config.json');
  const script = fileURLToPath(new URL('../skills/nodeclaw-image-gen/scripts/image-gen.mjs', import.meta.url));
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, APPDATA: home };
  const run = args => spawnSync(process.execPath, [script, 'setup', '--config', config, ...args, '--json'], { env, cwd: home, encoding: 'utf8', timeout: 10000 });
  const key = 'fixture-private-api-key';
  const created = run(['--api-base-url', 'https://custom.example/relay/v1', '--api-key', key, '--model', 'selected-image']);
  assert.equal(created.status, 0, created.stdout + created.stderr);
  assert.ok(!(created.stdout + created.stderr).includes(key));
  const saved = JSON.parse(await readFile(config, 'utf8'));
  assert.equal(saved.apiKey, key);
  assert.equal(saved.endpointMode, 'configured');
  if (process.platform !== 'win32') assert.equal((await stat(config)).mode & 0o777, 0o600);
  const ctx = await resolveContext({ cli: { config }, env: { ...env, CLAUDECODE: '1', ANTHROPIC_BASE_URL: 'https://harness.example', ANTHROPIC_AUTH_TOKEN: 'fixture-harness' }, cwd: home, homeDir: home });
  assert.equal(ctx.endpoints.length, 1);
  assert.equal(ctx.endpoints[0].baseUrl, 'https://custom.example/relay/v1');
  assert.equal(authorization(ctx.endpoints[0], {}).Authorization, `Bearer ${key}`);
  assert.ok(!JSON.stringify(ctx).includes(key));
  assert.ok(!('apiKey' in ctx.config));
  const refused = run(['--model', 'new-model']);
  assert.notEqual(refused.status, 0);
  assert.equal(JSON.parse(await readFile(config, 'utf8')).model, 'selected-image');
  assert.equal(run(['--model', 'new-model', '--replace']).status, 0);
  assert.equal(JSON.parse(await readFile(config, 'utf8')).apiKey, key);
  const status = run(['--status']);
  assert.equal(status.status, 0, status.stdout);
  assert.equal(JSON.parse(status.stdout).credentialConfigured, true);
  assert.ok(!status.stdout.includes(key));
  assert.equal(run(['--api-base-url', 'https://other.example/relay', '--replace']).status, 0);
  assert.ok(!JSON.parse(await readFile(config, 'utf8')).apiKey);
});

test('private keys stay at their configured origin and proxy path, including discovery and overrides', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-key-binding-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'config.json');
  await writeFile(config, JSON.stringify({ apiBaseUrl: 'https://custom.example/relay/v1', apiKey: 'fixture-saved', catalogUrl: 'https://catalog.example/list' }));
  const env = { CLAUDECODE: '1', ANTHROPIC_BASE_URL: 'https://harness.example', ANTHROPIC_AUTH_TOKEN: 'fixture-harness', NODECLAW_API_KEY: 'fixture-legacy' };
  const context = await resolveContext({ cli: { config }, env, cwd: home, homeDir: home });
  assert.equal(authorization(context.endpoints[0], env).Authorization, 'Bearer fixture-harness');
  assert.equal(authorization(context.endpoints[1], env).Authorization, 'Bearer fixture-saved');
  assert.equal(authorization(context.endpoints[2], env).Authorization, 'Bearer fixture-legacy');
  const requests = [];
  await discoverModels(context.endpoints[1], { env: {}, fetchImpl: async (url, options) => {
    requests.push({ url, authorization: options.headers.Authorization });
    return new Response(JSON.stringify(requests.length === 1 ? { data: { snapshot: { models: [] } } } : { data: [] }));
  } });
  assert.deepEqual(requests, [{ url: 'https://catalog.example/list', authorization: undefined }, { url: 'https://custom.example/relay/v1/models', authorization: 'Bearer fixture-saved' }]);
  for (const base of ['https://other.example', 'https://custom.example/other/v1']) {
    const pin = await resolveContext({ cli: { config, apiBaseUrl: base }, env: {}, cwd: home, homeDir: home });
    assert.throws(() => authorization(pin.endpoints[0], {}), /config|key/i);
  }
  const overridden = await resolveContext({ cli: { config }, env: { NODECLAW_IMAGE_GEN_API: 'https://override.example', NODECLAW_IMAGE_GEN_API_KEY: 'fixture-override' }, cwd: home, homeDir: home });
  assert.equal(authorization(overridden.endpoints[0], {}).Authorization, 'Bearer fixture-override');
  const wrongPin = await resolveContext({ cli: { config, apiBaseUrl: 'https://other.example' }, env: { NODECLAW_IMAGE_GEN_API: 'https://override.example', NODECLAW_IMAGE_GEN_API_KEY: 'fixture-override' }, cwd: home, homeDir: home });
  assert.throws(() => authorization(wrongPin.endpoints[0], {}), /config|key/i);
  await assert.rejects(resolveContext({ cli: { config }, env: { NODECLAW_IMAGE_GEN_API_KEY: 'fixture-orphan' }, cwd: home, homeDir: home }), /matching.*address/);
  await assert.rejects(resolveContext({ cli: { config, command: 'generate', apiKey: 'fixture-cli-key' }, env: {}, cwd: home, homeDir: home }), /setup-only/);
});

test('setup reads a bounded key from stdin without exposing it and accepts versioned base addresses', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-stdin-config-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'config.json');
  const script = fileURLToPath(new URL('../skills/nodeclaw-image-gen/scripts/image-gen.mjs', import.meta.url));
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, APPDATA: home };
  const args = [script, 'setup', '--config', config, '--api-base-url', 'https://proxy.example/prefix/v1beta', '--api-key-stdin', '--api-mode', 'gemini', '--json'];
  const invalid = spawnSync(process.execPath, args, { input: 'a'.repeat(8193), env, cwd: home, encoding: 'utf8', timeout: 10000 });
  assert.notEqual(invalid.status, 0);
  await assert.rejects(stat(config), { code: 'ENOENT' });
  const result = spawnSync(process.execPath, args, { input: 'fixture-piped-key\n', env, cwd: home, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!(result.stdout + result.stderr).includes('fixture-piped-key'));
  const ctx = await resolveContext({ cli: { config }, env, cwd: home, homeDir: home });
  assert.equal(authorization(ctx.endpoints[0], {}).Authorization, 'Bearer fixture-piped-key');
  assert.equal(apiUrl(ctx.endpoints[0], 'media/tasks'), 'https://proxy.example/prefix/v1/media/tasks');
  assert.equal(apiUrl(ctx.endpoints[0], 'models/native-image:generateContent', 'v1beta'), 'https://proxy.example/prefix/v1beta/models/native-image:generateContent');
});

test('interactive setup hides key echo and cancellation never returns a credential', async () => {
  const input = new PassThrough(); input.isTTY = true;
  let display = ''; let addressEntered = false; let keyEntered = false;
  const output = new Writable({ write(chunk, encoding, done) {
    display += chunk.toString();
    if (!addressEntered && display.includes('API base address')) {
      addressEntered = true; setImmediate(() => input.write('https://private.example\r'));
    }
    if (!keyEntered && display.includes('API key (hidden')) {
      keyEntered = true; setImmediate(() => input.write('fixture-hidden-key\r'));
    }
    done();
  } });
  output.isTTY = true;
  const result = await readSetupInput({ interactive: true }, { input, output });
  assert.equal(result.apiBaseUrl, 'https://private.example');
  assert.equal(result.apiKey, 'fixture-hidden-key');
  assert.ok(!display.includes('fixture-hidden-key'));
  const cancelled = new PassThrough(); cancelled.isTTY = true;
  const sink = new Writable({ write(chunk, encoding, done) { setImmediate(() => cancelled.write('\u0003')); done(); } });
  sink.isTTY = true;
  await assert.rejects(readSetupInput({ interactive: true }, { input: cancelled, output: sink }), /cancelled/);
  input.destroy(); cancelled.destroy();
});

test('native plugin configuration publishes one pair per activation and supersedes stale exports', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-plugin-config-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'));
  assert.equal(manifest.hooks?.SessionStart, undefined, 'the startup-only native writer must be retired');
  assert.equal(manifest.userConfig.api_key.sensitive, true);
  const hooksUrl = new URL('../hooks/hooks.json', import.meta.url);
  const hooks = JSON.parse(await readFile(hooksUrl, 'utf8'));
  assert.equal(hooks.modules.length, 1);
  const { register } = await import(new URL(hooks.modules[0], hooksUrl));
  const config = path.join(home, 'config.json');
  const saved = JSON.stringify({ apiBaseUrl: 'https://old.example', apiKey: 'fixture-saved' });
  await writeFile(config, saved);
  const env = { NODECLAW_IMAGE_GEN_API: 'not-a-url', NODECLAW_IMAGE_GEN_API_KEY: '\ninvalid-old-key',
    NODECLAW_IMAGE_GEN_ENDPOINT_MODE: 'invalid-old-mode', NODECLAW_API_KEY: 'fixture-legacy',
    CLAUDECODE: '1', ANTHROPIC_BASE_URL: 'https://harness.example', ANTHROPIC_AUTH_TOKEN: 'fixture-harness' };
  const pairs = [
    { api_base_url: 'https://plugin.example/first/v1/', api_key: 'fixture-first' },
    { api_base_url: 'https://plugin.example/second/v1/', api_key: "fixture-$(literal)'\"`" },
  ];
  for (const options of pairs) {
    let handler; const writes = [];
    register((event, hook) => { assert.equal(event, 'session.start'); handler = hook; }, options);
    const event = { cwd: home }; const continued = { cwd: home };
    assert.equal(await handler({ env: { set: async (name, value) => { writes.push(name); env[name] = value; return {}; } } }, event,
      async input => { assert.equal(input, event); return continued; }), continued);
    assert.deepEqual(writes, ['NODECLAW_IMAGE_GEN_PLUGIN_CONFIG']);
    assert.deepEqual(JSON.parse(env.NODECLAW_IMAGE_GEN_PLUGIN_CONFIG), { apiBaseUrl: options.api_base_url, apiKey: options.api_key });
    const context = await resolveContext({ cli: { config }, env, cwd: home, homeDir: home });
    assert.equal(context.endpoints.length, 1);
    assert.equal(context.endpoints[0].baseUrl, options.api_base_url.replace(/\/$/, ''));
    assert.equal(context.config.endpointMode, 'configured');
    assert.equal(authorization(context.endpoints[0], env).Authorization, `Bearer ${options.api_key}`);
    assert.ok(!JSON.stringify(context).includes(options.api_key));
    assert.equal(await readFile(config, 'utf8'), saved);
  }
  if (process.platform !== 'win32') {
    const envFile = path.join(home, 'old-session.env');
    const oldExports = 'export NODECLAW_IMAGE_GEN_API=https://old.example\nexport NODECLAW_IMAGE_GEN_API_KEY=fixture-old\nexport NODECLAW_IMAGE_GEN_ENDPOINT_MODE=configured\n';
    await writeFile(envFile, oldExports, { mode: 0o600 });
    const script = fileURLToPath(new URL('../skills/nodeclaw-image-gen/scripts/image-gen.mjs', import.meta.url));
    const downstream = spawnSync('bash', ['-c', 'source "$1"; exec "$2" "$3" setup --status --json', 'bridge-test', envFile, process.execPath, script], {
      env: { PATH: process.env.PATH, HOME: home, NODECLAW_IMAGE_GEN_PLUGIN_CONFIG: env.NODECLAW_IMAGE_GEN_PLUGIN_CONFIG }, cwd: home, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(downstream.status, 0, downstream.stderr + downstream.stdout);
    assert.equal(JSON.parse(downstream.stdout).apiBaseUrl, 'https://plugin.example/second/v1');
    assert.equal(JSON.parse(downstream.stdout).credentialConfigured, true);
    assert.ok(!downstream.stdout.includes(pairs[1].api_key));
    assert.equal(await readFile(envFile, 'utf8'), oldExports);
  }
});

test('native plugin configuration reports denied or rejected writes without exposing their values', async () => {
  const { register } = await import('../hooks/register.mjs');
  const options = { api_base_url: 'https://plugin.example', api_key: 'fixture-native-sensitive' };
  for (const failure of ['hold', 'rejection']) {
    let handler; const messages = []; let writes = 0;
    register((event, hook) => { handler = hook; }, options);
    const result = await handler({
      env: { set: async () => { writes++; if (failure === 'hold') return { deny: options.api_key }; throw new Error(options.api_key); } },
      ui: { log: text => messages.push(text) },
    }, { cwd: '/fixture' }, async () => ({ cwd: '/fixture' }));
    assert.deepEqual(result, { cwd: '/fixture' });
    assert.equal(writes, 1);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /could not be applied/);
    assert.ok(!messages[0].includes(options.api_key));
  }
});

test('native plugin configuration rejects invalid present bindings without credential fallback', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-plugin-invalid-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'config.json');
  await writeFile(config, JSON.stringify({ apiBaseUrl: 'https://old.example', apiKey: 'fixture-saved' }));
  const env = { NODECLAW_IMAGE_GEN_API: 'https://old.example', NODECLAW_IMAGE_GEN_API_KEY: 'fixture-old', NODECLAW_API_KEY: 'fixture-legacy' };
  const invalid = ['', '{', 'null', '[]', '{}', JSON.stringify({ apiBaseUrl: 'https://plugin.example' }),
    JSON.stringify({ apiBaseUrl: 'https://plugin.example', apiKey: '' }),
    JSON.stringify({ apiBaseUrl: 'https://plugin.example', apiKey: 1 }),
    JSON.stringify({ apiBaseUrl: 'https://plugin.example', apiKey: 'fixture-\ninvalid' }),
    JSON.stringify({ apiBaseUrl: 'https://user:pass@plugin.example', apiKey: 'fixture-key' }),
    JSON.stringify({ apiBaseUrl: 1, apiKey: 'fixture-key' })];
  for (const binding of invalid) await assert.rejects(resolveContext({ cli: { config }, env: { ...env, NODECLAW_IMAGE_GEN_PLUGIN_CONFIG: binding }, cwd: home, homeDir: home }),
    error => error.code === 'invalid_input' && !error.message.includes('fixture-') && !error.message.includes(binding || 'never-match'));
});

test('native plugin configuration never carries its key or legacy fallback across an explicit pin', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-plugin-pin-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const env = { NODECLAW_IMAGE_GEN_PLUGIN_CONFIG: JSON.stringify({ apiBaseUrl: 'https://plugin.example/relay/v1/', apiKey: 'fixture-native' }),
    NODECLAW_API_KEY: 'fixture-legacy', NODECLAW_IMAGE_GEN_API: 'https://other.example', NODECLAW_IMAGE_GEN_API_KEY: 'fixture-old' };
  for (const apiBaseUrl of ['https://other.example', 'https://plugin.example/other/v1']) {
    const context = await resolveContext({ cli: { apiBaseUrl }, env, cwd: home, homeDir: home });
    assert.equal(context.endpoints[0].baseUrl, apiBaseUrl);
    assert.throws(() => authorization(context.endpoints[0], env), /key|config/i);
  }
  const context = await resolveContext({ cli: { apiBaseUrl: 'https://plugin.example/relay/v1' }, env, cwd: home, homeDir: home });
  assert.equal(authorization(context.endpoints[0], env).Authorization, 'Bearer fixture-native');
});

// Protect explicit false, endpoint ownership and exact-ID discovery, not UI copy.
test('config preserves false, selects one file and binds credentials to their endpoint', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-config-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'config.json');
  await writeFile(config, JSON.stringify({ model: 'configured', apiBaseUrl: 'https://configured.example/v1', fallback: { enabled: true } }));
  const env = { NODECLAW_IMAGE_GEN_CONFIG: config, NODECLAW_IMAGE_GEN_MODEL: 'env-model',
    NODECLAW_IMAGE_GEN_FALLBACK: 'false', ANTHROPIC_BASE_URL: 'https://proxy.example/prefix/v1',
    ANTHROPIC_AUTH_TOKEN: 'test-only-harness-token', NODECLAW_API_KEY: 'test-only-native-key' };
  const ctx = await resolveContext({ cli: { harness: 'claude-code', model: 'chosen' }, env, cwd: home, homeDir: home });
  assert.equal(ctx.config.model, 'chosen');
  assert.equal(ctx.config.fallback.enabled, false);
  assert.equal(ctx.endpoints[0].apiKeyEnv, 'ANTHROPIC_AUTH_TOKEN');
  assert.equal(ctx.endpoints.at(-1).apiKeyEnv, 'NODECLAW_API_KEY');
  assert.equal(apiUrl(ctx.endpoints[0], 'models'), 'https://proxy.example/prefix/v1/models');
  assert.ok(!JSON.stringify(ctx).includes('test-only-'));
  const pin = await resolveContext({ cli: { apiBaseUrl: 'https://custom.example/relay', provider: 'openai-compatible' }, env, cwd: home, homeDir: home });
  assert.equal(pin.endpoints.length, 1);
  assert.equal(apiUrl(pin.endpoints[0], 'images/edits'), 'https://custom.example/relay/v1/images/edits');
  await assert.rejects(resolveContext({ cli: {}, env: { NODECLAW_IMAGE_GEN_FALLBACK: 'maybe' }, cwd: home, homeDir: home }), /FALLBACK/);
});

test('catalogs run sequentially, merge exact IDs and retain Image pairs over Chat metadata', async () => {
  const events = [];
  const endpoint = { baseUrl: 'https://payg.nodenetwork.ovh', provider: 'nodeclaw', catalogUrl: 'https://app.nodenetwork.ovh/api/payg-model-data' };
  const fetchImpl = async url => {
    events.push(String(url));
    const body = events.length === 1
      ? { data: { snapshot: { models: [{ modelId: 'GPT-Image', operationCompatibilities: [{ operation: 'image_edit', compatibilityKey: 'openai_image_edits' }], operations: [] }] } } }
      : { data: [{ id: 'GPT-Image', capabilities: ['chat.completions'] }, { id: 'gpt-image' }] };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
  const view = await discoverModels(endpoint, { fetchImpl, env: {} });
  assert.deepEqual(events, [endpoint.catalogUrl, 'https://payg.nodenetwork.ovh/v1/models']);
  assert.deepEqual(view.models.map(m => m.id), ['GPT-Image', 'gpt-image']);
  assert.equal(view.models[0].pairs[0].compatibilityKey, 'openai_image_edits');
  assert.deepEqual(view.models[0].sources, ['catalog', 'models']);
});

test('unavailable discovery still admits an exact manual model without crossing endpoints', async () => {
  const ctx = await resolveContext({ cli: { apiBaseUrl: 'https://custom.example/v1', provider: 'openai-compatible', model: 'private-image' }, env: {}, cwd: os.tmpdir(), homeDir: os.tmpdir() });
  const view = await discoverModels(ctx.endpoints[0], { env: {}, fetchImpl: async () => new Response('{}', { status: 503 }) });
  assert.equal(view.status, 'catalog_unavailable');
  assert.deepEqual(view.models, []);
  assert.equal(ctx.config.model, 'private-image');
  assert.equal(ctx.endpoints.length, 1);
});

test('native catalog override and configured fallback do not displace the active harness', async () => {
  const ctx = await resolveContext({ cli: { harness: 'claude-code' }, env: {
    ANTHROPIC_BASE_URL: 'https://harness.example/prefix',
    NODECLAW_IMAGE_GEN_CATALOG_URL: 'https://catalog.example/models',
    NODECLAW_IMAGE_GEN_DOCS_URL: 'https://docs.example/images.md',
  }, cwd: os.tmpdir(), homeDir: os.tmpdir() });
  assert.equal(ctx.endpoints[0].source, 'harness');
  assert.equal(ctx.endpoints.at(-1).catalogUrl, 'https://catalog.example/models');
  assert.equal(ctx.endpoints.at(-1).apiDocsUrl, 'https://docs.example/images.md');
});

test('CLI setup persists chosen settings and spec-only dry-run uses its explicit model', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-cli-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const config = path.join(home, 'config.json');
  const script = fileURLToPath(new URL('../skills/nodeclaw-image-gen/scripts/image-gen.mjs', import.meta.url));
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, APPDATA: home };
  const setup = spawnSync(process.execPath, [script, 'setup', '--config', config, '--model', 'chosen-image', '--api-base-url', 'https://custom.example', '--provider', 'openai-compatible', '--json'], { env, cwd: home, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stdout);
  const ctx = await resolveContext({ cli: { config }, env, cwd: home, homeDir: home });
  assert.equal(ctx.config.model, 'chosen-image');
  const spec = path.join(home, 'spec.json');
  await writeFile(spec, JSON.stringify({ prompt: 'one brief', model: 'spec-model', apiBaseUrl: 'https://spec.example/relay', provider: 'openai-compatible', skipDiscovery: true }));
  const dry = spawnSync(process.execPath, [script, 'generate', '--spec', spec, '--dry-run', '--json'], { env, cwd: home, encoding: 'utf8', timeout: 10000 });
  assert.equal(dry.status, 0, dry.stdout);
  const result = JSON.parse(dry.stdout);
  assert.equal(result.model, 'spec-model'); assert.equal(result.endpoint, 'https://spec.example/relay');
  const offline = spawnSync(process.execPath, [script, 'techniques', 'list', '--json'], { env: { ...env, CLAUDECODE: '1', ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317' }, cwd: home, encoding: 'utf8' });
  assert.equal(offline.status, 0, offline.stdout);
  assert.ok(JSON.parse(offline.stdout).items.some(item => item.id === 'pixel-art-detail'));
});
