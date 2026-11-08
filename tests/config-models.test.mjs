import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveContext, apiUrl } from '../skills/nodeclaw-image-gen/scripts/config.mjs';
import { discoverModels } from '../skills/nodeclaw-image-gen/scripts/models.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
