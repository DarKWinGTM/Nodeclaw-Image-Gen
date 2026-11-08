import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { resolveContext } from '../skills/nodeclaw-image-gen/scripts/config.mjs';
import { planImageRequest, executeDirect } from '../skills/nodeclaw-image-gen/scripts/images.mjs';
import { runTask, resumeTask } from '../skills/nodeclaw-image-gen/scripts/tasks.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const taskId = 'req-1-0123456789abcdef0123456789abcdef';
async function fixture(t, handler) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-flow-'));
  const server = http.createServer((req, res) => Promise.resolve(handler(req, res, dir)).catch(() => { res.statusCode = 500; res.end('{}'); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const env = { NODECLAW_API_KEY: 'test-only-key' };
  const context = await resolveContext({ cli: { apiBaseUrl: endpoint, provider: 'nodeclaw', allowLocalHttp: true, outputDir: dir, pollIntervalMs: '1', requestMs: '1000', waitMs: '1000' }, env, cwd: dir, homeDir: dir });
  context.env = env;
  return { context, dir, endpoint };
}
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); }
function json(res, value, status = 200) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }

test('Task-first saves actual bytes, persists identity before POST and resumes the same task', async t => {
  let posts = 0; let reads = 0; let signature;
  const { context, dir } = await fixture(t, async (req, res) => {
    if (req.method === 'POST') {
      posts++; signature = req.headers['request-signature'];
      const names = await readdir(path.join(context.stateDir, 'tasks'));
      assert.equal(names.length, 1);
      const handle = await readFile(path.join(context.stateDir, 'tasks', names[0]), 'utf8');
      assert.ok(handle.includes(signature)); assert.ok(!handle.includes('private brief'));
      assert.deepEqual(JSON.parse(await body(req)), { operation: 'image_generation', request: { model: 'gpt-image-2', prompt: 'private brief', n: 1, compatibilityKey: 'openai_image_generations', stream: false, partial_images: 0 } });
      return json(res, { taskId, status: 'queued' }, 202);
    }
    reads++;
    json(res, reads === 1 ? { taskId, status: 'reconciling' } : { taskId, status: 'succeeded', result: { data: [{ b64_json: png.toString('base64') }] } });
  });
  const plan = await planImageRequest(context, { prompt: 'private brief', skipDiscovery: true });
  const result = await runTask(plan);
  assert.equal(result.status, 'saved'); assert.equal(posts, 1); assert.ok(reads >= 2);
  assert.deepEqual(await readFile(result.paths[0]), png);
  assert.ok(!JSON.stringify(result).includes('private brief'));
  const resumed = await resumeTask(result.handle, context);
  assert.equal(resumed.status, 'saved'); assert.equal(posts, 1);
  assert.equal((await readdir(dir)).filter(n => n.endsWith('.png')).length, 1);
  await rm(resumed.paths[0]);
  const recovered = await resumeTask(result.handle, context);
  assert.equal(recovered.status, 'saved'); assert.equal(posts, 1);
  assert.deepEqual(await readFile(recovered.paths[0]), png);
});

test('lost create reply resolves original signature without a second POST or Direct fallback', async t => {
  let posts = 0; let resolves = 0; let signature;
  const { context } = await fixture(t, async (req, res) => {
    if (req.method === 'POST') { posts++; signature = req.headers['request-signature']; await body(req); req.socket.destroy(); return; }
    resolves++; assert.equal(req.headers['request-signature'], signature);
    json(res, { error: { code: 'task_not_found' } }, 404);
  });
  const result = await runTask(await planImageRequest(context, { prompt: 'one call only', skipDiscovery: true }));
  assert.equal(result.status, 'outcome_unknown'); assert.equal(posts, 1); assert.equal(resolves, 1);
});

test('resume authorizes only current endpoint bindings, never a handle-selected secret', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-resume-binding-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const endpoint = 'https://trusted.invalid/proxy';
  const env = { NODECLAW_IMAGE_GEN_API: endpoint, NODECLAW_API_KEY: 'test-only-key', UNRELATED_SECRET: 'test-only-unrelated' };
  const context = await resolveContext({ cli: { provider: 'nodeclaw', outputDir: dir }, env, cwd: dir, homeDir: dir });
  const handlePath = path.join(dir, 'handle.json');
  const handle = { schemaVersion: 1, kind: 'image-task', signature: '01234567-89ab-4cde-8fab-0123456789ab',
    endpoint: { ...context.endpoints[0], apiKeyEnv: 'UNRELATED_SECRET' }, operation: 'image_generation', model: 'gpt-image-2',
    outputIntent: { directory: dir, format: 'auto' }, summary: {} };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method, authorization: options.headers.Authorization });
    return Response.json({ taskId, status: 'succeeded', result: { data: [{ b64_json: png.toString('base64') }] } });
  };
  for (const baseUrl of ['https://untrusted.invalid/proxy', 'https://trusted.invalid/other']) {
    await writeFile(handlePath, JSON.stringify({ ...handle, endpoint: { ...handle.endpoint, baseUrl } }));
    await assert.rejects(resumeTask(handlePath, context, { env, fetchImpl }), { code: 'invalid_input' });
    assert.equal(requests.length, 0);
  }
  context.endpoints.unshift({ ...context.endpoints[0], baseUrl: 'https://active.invalid', source: 'harness', apiKeyEnv: 'HARNESS_KEY' });
  await writeFile(handlePath, JSON.stringify(handle));
  const result = await resumeTask(handlePath, context, { env, fetchImpl });
  assert.equal(result.status, 'saved');
  assert.deepEqual(await readFile(result.paths[0]), png);
  assert.deepEqual(requests, [{ url: `${endpoint}/v1/media/tasks`, method: 'GET', authorization: 'Bearer test-only-key' }]);
});

test('Edit multipart carries exact local bytes and top-level Task operation', async t => {
  let wire;
  const { context, dir } = await fixture(t, async (req, res) => {
    wire = await body(req);
    assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
    json(res, { taskId, status: 'succeeded', result: { data: [{ b64_json: png.toString('base64') }] } }, 202);
  });
  const image = path.join(dir, 'ต้นฉบับ image.png'); await writeFile(image, png);
  const result = await runTask(await planImageRequest(context, { operation: 'image_edit', prompt: 'preserve position', image: [image], skipDiscovery: true }));
  assert.equal(result.status, 'saved');
  assert.ok(wire.includes(png));
  assert.match(wire.toString(), /name="operation"\r\n\r\nimage_edit/);
  assert.match(wire.toString(), /name="compatibilityKey"\r\n\r\nopenai_image_edits/);
  assert.doesNotMatch(wire.toString(), /name="request"/);
});

test('Direct keeps saved images on partial download failure and does not forward API auth', async t => {
  let posts = 0; let cdnAuth;
  const { context, endpoint, dir } = await fixture(t, async (req, res) => {
    if (req.method === 'POST') {
      posts++; await body(req);
      return json(res, { data: [{ b64_json: png.toString('base64') }, { url: `${endpoint}/missing.png` }] });
    }
    cdnAuth = req.headers.authorization; res.writeHead(404); res.end();
  });
  const result = await executeDirect(await planImageRequest(context, { method: 'direct', prompt: 'two results', skipDiscovery: true }));
  assert.equal(result.status, 'save_failed'); assert.equal(result.paths.length, 1); assert.equal(posts, 1); assert.equal(cdnAuth, undefined);
  assert.deepEqual(await readFile(result.paths[0]), png);
  const savedPath = result.paths[0];
  await rm(savedPath);
  const resumed = await resumeTask(result.handle, context);
  assert.equal(resumed.status, 'save_failed');
  assert.equal(posts, 1);
  assert.equal(resumed.paths.includes(savedPath), false, 'missing prior output must not be claimed as saved');
  const output = path.join(dir, 'keep.png'); await writeFile(output, 'existing');
  const collision = await executeDirect(await planImageRequest(context, { method: 'direct', prompt: 'no overwrite', output, skipDiscovery: true }));
  assert.equal(collision.status, 'save_failed'); assert.equal(await readFile(output, 'utf8'), 'existing');
});

test('Direct SSE requires the operation completed event, not partial image or EOF', async t => {
  let completed = false;
  const { context } = await fixture(t, async (req, res) => {
    await body(req); res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(`event: image_generation.${completed ? 'completed' : 'partial_image'}\ndata: ${JSON.stringify({ type: `image_generation.${completed ? 'completed' : 'partial_image'}`, b64_json: png.toString('base64') })}\n\n`);
  });
  const plan = await planImageRequest(context, { method: 'direct', prompt: 'finite', skipDiscovery: true });
  assert.equal((await executeDirect(plan)).status, 'outcome_unknown');
  completed = true;
  assert.equal((await executeDirect(plan)).status, 'saved');
});

test('advanced Google input preserves native content and does not invent OpenAI quantity', async t => {
  const { context } = await fixture(t, async () => {});
  const plan = await planImageRequest(context, { request: { model: 'native-google', compatibilityKey: 'google_image_generate_content', contents: [{ parts: [{ text: 'draw' }] }] }, skipDiscovery: true });
  assert.deepEqual(plan.payload.contents, [{ parts: [{ text: 'draw' }] }]);
  assert.equal(plan.payload.n, undefined);
});

test('CLI submits one authorized request and its JSON result points at actual saved bytes', async t => {
  let posts = 0;
  const { endpoint, dir } = await fixture(t, async (req, res) => {
    assert.equal(req.method, 'POST'); posts++; await body(req);
    json(res, { data: [{ b64_json: png.toString('base64') }] });
  });
  const script = fileURLToPath(new URL('../skills/nodeclaw-image-gen/scripts/image-gen.mjs', import.meta.url));
  const { stdout } = await promisify(execFile)(process.execPath, [script, 'generate', '--prompt', 'local test only', '--api-base-url', endpoint,
    '--provider', 'openai-compatible', '--allow-local-http', '--skip-discovery', '--yes', '--json', '--output-dir', dir],
    { cwd: dir, env: { PATH: process.env.PATH, HOME: dir, USERPROFILE: dir, APPDATA: dir, NODECLAW_API_KEY: 'test-only-key' }, timeout: 10000 });
  const result = JSON.parse(stdout);
  assert.equal(result.status, 'saved'); assert.equal(posts, 1);
  assert.deepEqual(await readFile(result.paths[0]), png);
});

test('terminal opt-in does not infer again from an unverified public error category', async t => {
  let posts = 0;
  const { context } = await fixture(t, async (req, res) => {
    if (req.method === 'POST') { posts++; await body(req); }
    json(res, { taskId, status: 'failed', error: { code: 'upstream_error', message: 'Public error does not establish replay eligibility' } }, 202);
  });
  context.config.fallback.onTerminalFailure = true;
  const result = await runTask(await planImageRequest(context, { prompt: 'one paid attempt only', skipDiscovery: true }));
  assert.equal(posts, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.taskStatus, 'failed');
});

test('known refusal never falls back and pending timeout keeps a resumable identity', async t => {
  let posts = 0; let pending = false;
  const { context } = await fixture(t, async (req, res) => {
    if (req.method === 'POST') { posts++; await body(req); }
    if (pending) { res.setHeader('retry-after', '2'); return json(res, { taskId, status: 'processing' }, req.method === 'POST' ? 202 : 200); }
    json(res, { error: { code: 'permission_denied' } }, 403);
  });
  const plan = await planImageRequest(context, { prompt: 'test', skipDiscovery: true });
  assert.equal((await runTask(plan)).status, 'failed'); assert.equal(posts, 1);
  pending = true;
  const result = await runTask(plan);
  assert.equal(result.status, 'pending'); assert.ok(result.handle); assert.equal(posts, 2);
});
