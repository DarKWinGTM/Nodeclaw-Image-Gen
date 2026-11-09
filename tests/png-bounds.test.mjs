import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readPng } from '../skills/nodeclaw-image-gen/scripts/raster.mjs';

const png = createRequire(import.meta.url)('../skills/nodeclaw-image-gen/vendor/pngjs/lib/png-sync.js');

test('PNG ingress rejects duplicate headers before a decoder can replace checked dimensions', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'png-bounds-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bytes = png.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) });
  const file = path.join(dir, 'duplicate.png');
  await writeFile(file, Buffer.concat([bytes.subarray(0, 33), bytes.subarray(8)]));
  await assert.rejects(readPng(file), /header/i);
});
