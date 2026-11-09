import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveContext } from '../skills/nodeclaw-image-gen/scripts/config.mjs';
import { planImageRequest } from '../skills/nodeclaw-image-gen/scripts/images.mjs';

const require = createRequire(import.meta.url);
const png = require('../skills/nodeclaw-image-gen/vendor/pngjs/lib/png-sync.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/nodeclaw-image-gen/scripts/image-gen.mjs');
const run = (...args) => {
  const result = spawnSync(process.execPath, [cli, 'techniques', ...args, '--json'], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 65536,
    env: { ...process.env, ANTHROPIC_BASE_URL: 'http://irrelevant.invalid' },
  });
  return { code: result.status, value: JSON.parse(result.stdout), stderr: result.stderr };
};
async function workspace(t) {
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), 'image-technique-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function image(file, width, height, pixel) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  await writeFile(file, png.write({ width, height, data }));
}
const rgba = (im, x, y) => [...im.data.subarray((y * im.width + x) * 4, (y * im.width + x + 1) * 4)];

test('pixel tools prepare real tiles and existing-client specs, then merge both output sizes without clobber', async t => {
  const dir = await workspace(t); const source = path.join(dir, 'source ภาพ.png'); const work = path.join(dir, 'work with space');
  const original = (x, y) => [40 + x * 10, 80 + y * 10, 100, x === 0 ? 0 : x === 1 ? 128 : 255];
  await image(source, 5, 3, original);
  const prepared = run('prepare', 'pixel-art-detail', '--image', source, '--work-dir', work, '--scale', '2', '--tile-size', '6x4', '--overlap', '0.25');
  assert.equal(prepared.code, 0, JSON.stringify(prepared.value));
  assert.equal(prepared.value.status, 'prepared'); assert.equal(prepared.value.requestCount, 4);
  const jobFile = path.join(work, 'job.json'); const job = JSON.parse(await readFile(jobFile, 'utf8'));
  assert.deepEqual(job.target, { width: 10, height: 6 });
  assert.deepEqual(job.tiles.map(({ x, y, width, height }) => [x, y, width, height]), [[0, 0, 6, 4], [4, 0, 6, 4], [0, 2, 6, 4], [4, 2, 6, 4]]);
  const context = await resolveContext({ cli: {}, env: {}, cwd: dir, homeDir: dir });
  for (const tile of job.tiles) {
    const input = png.read(await readFile(path.join(work, tile.input)));
    assert.equal(input.width, 6); assert.equal(input.height, 4);
    assert.deepEqual(rgba(input, 0, 0), original(tile.x / 2, tile.y / 2));
    const spec = JSON.parse(await readFile(path.join(work, tile.spec), 'utf8'));
    const plan = await planImageRequest(context, { ...spec, skipDiscovery: true, operation: 'image_edit' });
    assert.equal(plan.operation, 'image_edit'); assert.equal(plan.payload.n, 1); assert.equal(plan.payload.size, '6x4');
    assert.equal(plan.files[0].filename, path.join(work, tile.input)); assert.equal(spec.yes, undefined);
    await writeFile(path.join(work, tile.result), png.write(input));
  }
  assert.equal(run('check', '--job', jobFile).value.status, 'ready');
  const merged = run('merge', '--job', jobFile);
  assert.equal(merged.code, 0, JSON.stringify(merged.value)); assert.equal(merged.value.status, 'saved');
  const hires = png.read(await readFile(path.join(work, 'refined-hires.png')));
  const small = png.read(await readFile(path.join(work, 'refined-original-size.png')));
  assert.deepEqual([hires.width, hires.height, small.width, small.height], [10, 6, 5, 3]);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) {
    assert.deepEqual(rgba(small, x, y), original(x, y));
    assert.deepEqual(rgba(hires, x * 2 + 1, y * 2 + 1), original(x, y));
  }
  const before = await readFile(path.join(work, 'refined-hires.png'));
  assert.notEqual(run('merge', '--job', jobFile).code, 0);
  assert.deepEqual(await readFile(path.join(work, 'refined-hires.png')), before);
  assert.notEqual(run('prepare', 'pixel-art-detail', '--image', source, '--work-dir', work).code, 0);
});

test('pixel tools preserve alpha and protected pixels, restore low-frequency colour and reject incomplete edits', async t => {
  const dir = await workspace(t); const source = path.join(dir, 'source.png'); const mask = path.join(dir, 'mask.png'); const work = path.join(dir, 'work');
  await image(source, 4, 2, x => [80, 100, 120, x === 0 ? 100 : 255]);
  await image(mask, 4, 2, x => [0, 0, 0, x >= 2 ? 255 : 0]);
  const prepared = run('prepare', 'pixel-art-detail', '--image', source, '--mask', mask, '--work-dir', work, '--scale', '2', '--tile-size', '4x4', '--overlap', '0', '--color-sigma', '1');
  assert.equal(prepared.code, 0, JSON.stringify(prepared.value)); assert.equal(prepared.value.requestCount, 1);
  const file = path.join(work, 'job.json'); const job = JSON.parse(await readFile(file, 'utf8'));
  const missing = run('check', '--job', file);
  assert.equal(missing.code, 3); assert.equal(missing.value.missing.length, 1);
  assert.notEqual(run('merge', '--job', file).code, 0);
  const tile = job.tiles.find(item => !item.skipped);
  await image(path.join(work, tile.result), 3, 4, () => [200, 20, 40, 0]);
  assert.equal(run('check', '--job', file).value.invalid.length, 1);
  await image(path.join(work, tile.result), 4, 4, () => [200, 20, 40, 0]);
  const merged = run('merge', '--job', file); assert.equal(merged.code, 0, JSON.stringify(merged.value));
  const output = png.read(await readFile(path.join(work, 'refined-hires.png')));
  assert.deepEqual(rgba(output, 1, 1), [80, 100, 120, 100]);
  assert.deepEqual(rgba(output, 5, 1), [80, 100, 120, 255]);
  await writeFile(path.join(work, 'source.png'), 'tampered');
  assert.notEqual(run('check', '--job', file).code, 0);
});

test('partial outputs stay explicitly partial, padding stays transparent and signed detail is retained', async t => {
  const dir = await workspace(t); const source = path.join(dir, 'source.png'); const work = path.join(dir, 'work');
  await image(source, 3, 2, () => [100, 100, 100, 255]);
  assert.equal(run('prepare', 'pixel-art-detail', '--image', source, '--work-dir', work, '--scale', '2', '--tile-size', '4x6', '--overlap', '0', '--color-sigma', '1').code, 0);
  const file = path.join(work, 'job.json'); const job = JSON.parse(await readFile(file, 'utf8'));
  const padded = png.read(await readFile(path.join(work, job.tiles[1].input)));
  assert.deepEqual(rgba(padded, 3, 0), [0, 0, 0, 0]); assert.deepEqual(rgba(padded, 0, 5), [0, 0, 0, 0]);
  await image(path.join(work, job.tiles[0].result), 4, 6, x => x % 2 ? [250, 250, 250, 255] : [50, 50, 50, 255]);
  const result = run('merge', '--job', file, '--allow-partial');
  assert.equal(result.code, 3); assert.equal(result.value.status, 'partial'); assert.equal(result.value.missing.length, 1);
  const out = png.read(await readFile(path.join(work, 'partial-hires.png')));
  assert.deepEqual(rgba(out, 5, 0), [100, 100, 100, 255]);
  assert.ok(rgba(out, 0, 0)[0] < 100); assert.ok(rgba(out, 1, 0)[0] > 100);
});

test('overlap blending uses saved placement and rejects altered job paths', async t => {
  const dir = await workspace(t); const source = path.join(dir, 'source.png'); const work = path.join(dir, 'work');
  await image(source, 5, 2, () => [100, 100, 100, 255]);
  assert.equal(run('prepare', 'pixel-art-detail', '--image', source, '--work-dir', work, '--scale', '2', '--tile-size', '6x4', '--overlap', '0.25', '--color-sigma', '0').code, 0);
  const file = path.join(work, 'job.json'); const job = JSON.parse(await readFile(file, 'utf8'));
  await image(path.join(work, job.tiles[0].result), 6, 4, () => [255, 0, 0, 255]);
  await image(path.join(work, job.tiles[1].result), 6, 4, () => [0, 0, 255, 255]);
  assert.equal(run('merge', '--job', file).code, 0);
  const output = png.read(await readFile(path.join(work, 'refined-hires.png')));
  assert.deepEqual(rgba(output, 4, 1), [170, 0, 85, 255]);
  assert.deepEqual(rgba(output, 5, 1), [85, 0, 170, 255]);
  job.tiles[0].result = '../outside.png'; await writeFile(file, JSON.stringify(job));
  const rejected = run('check', '--job', file);
  assert.equal(rejected.code, 2); assert.match(rejected.value.error.message, /geometry or paths/);
});

test('composition preparation uses the same Edit path and check rejects dimension mismatch', async t => {
  const dir = await workspace(t); const source = path.join(dir, 'source.png'); const work = path.join(dir, 'composition');
  await image(source, 3, 2, () => [1, 2, 3, 128]);
  const prepared = run('prepare', 'preserve-composition', '--image', source, '--work-dir', work, '--change', 'Change the sky only', '--preserve', 'camera,character');
  assert.equal(prepared.code, 0, JSON.stringify(prepared.value)); assert.equal(prepared.value.requestCount, 1);
  const job = JSON.parse(await readFile(path.join(work, 'job.json'), 'utf8'));
  const spec = JSON.parse(await readFile(path.join(work, job.tiles[0].spec), 'utf8'));
  assert.match(spec.prompt, /Change the sky only/); assert.match(spec.prompt, /camera/);
  await image(path.join(work, job.tiles[0].result), 2, 2, () => [1, 2, 3, 255]);
  assert.equal(run('check', '--job', path.join(work, 'job.json')).value.invalid.length, 1);
});
