import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveContext, apiUrl, readSetupInput } from '../skills/nodeclaw-image-gen/scripts/config.mjs';
import { PassThrough, Writable } from 'node:stream';
import { createHash } from 'node:crypto';
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

test('native plugin hook binds sensitive options through a private, literal session environment', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'image-plugin-config-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(await readFile(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const hook = manifest.hooks?.SessionStart?.[0]?.hooks?.[0];
  assert.ok(hook, 'native configuration needs a supported SessionStart bridge');
  assert.equal(manifest.userConfig.api_key.sensitive, true);
  const envFile = path.join(home, 'session.env');
  const sentinel = path.join(home, 'must-not-exist');
  const key = "fixture-$(touch${IFS}" + sentinel + ")'\"`";
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, APPDATA: home,
    CLAUDE_ENV_FILE: envFile, CLAUDE_PLUGIN_OPTION_API_BASE_URL: 'https://plugin.example/relay/v1', CLAUDE_PLUGIN_OPTION_API_KEY: key };
  const args = hook.args.map(value => value.replace('${CLAUDE_PLUGIN_ROOT}', root));
  const run = spawnSync(process.execPath, args, { env, cwd: home, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(run.stdout, '');
  assert.ok(!run.stderr.includes(key));
  if (process.platform !== 'win32') {
    assert.equal((await stat(envFile)).mode & 0o777, 0o600);
    const script = `import {resolveContext} from ${JSON.stringify(new URL('../skills/nodeclaw-image-gen/scripts/config.mjs', import.meta.url).href)}; import {authorization} from ${JSON.stringify(new URL('../skills/nodeclaw-image-gen/scripts/http.mjs', import.meta.url).href)}; import {createHash} from 'node:crypto'; const c=await resolveContext(); console.log(JSON.stringify({endpoint:c.endpoints[0].baseUrl,hash:createHash('sha256').update(authorization(c.endpoints[0]).Authorization).digest('hex')}));`;
    const downstream = spawnSync('bash', ['-c', 'source "$1"; exec "$2" --input-type=module -e "$3"', 'bridge-test', envFile, process.execPath, script], { env: { PATH: process.env.PATH, HOME: home }, cwd: home, encoding: 'utf8', timeout: 10000 });
    assert.equal(downstream.status, 0, downstream.stderr);
    assert.deepEqual(JSON.parse(downstream.stdout), { endpoint: 'https://plugin.example/relay/v1', hash: createHash('sha256').update(`Bearer ${key}`).digest('hex') });
    await assert.rejects(stat(sentinel), { code: 'ENOENT' });
    const unsafe = path.join(home, 'unsafe.env'); await writeFile(unsafe, '', { mode: 0o644 });
    const refused = spawnSync(process.execPath, args, { env: { ...env, CLAUDE_ENV_FILE: unsafe }, cwd: home, encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.equal(await readFile(unsafe, 'utf8'), '');
  }
  const missing = spawnSync(process.execPath, args, { env: { ...env, CLAUDE_ENV_FILE: '' }, cwd: home, encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.ok(!(missing.stdout + missing.stderr).includes(key));
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
