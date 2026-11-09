import { open, writeFile, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { inputError } from './config.mjs';

const require = createRequire(import.meta.url);
const png = require('../vendor/pngjs/lib/png-sync.js');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const MAX_PIXELS = 16 * 1024 * 1024;

export async function readPng(file) {
  const handle = await open(file, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size < 33 || size > 32 * 1024 * 1024) throw inputError('PNG input must be between 33 bytes and 32 MiB');
    const header = Buffer.alloc(33);
    await handle.read(header, 0, 33, 0);
    if (!header.subarray(0, 8).equals(signature) || header.readUInt32BE(8) !== 13 || header.toString('ascii', 12, 16) !== 'IHDR') throw inputError('Technique tools require an ordinary PNG');
    const width = header.readUInt32BE(16); const height = header.readUInt32BE(20);
    if (!width || !height || width * height > MAX_PIXELS) throw inputError('PNG exceeds the 16 megapixel limit');
    if (header[24] !== 8 || header[28] !== 0) throw inputError('Technique tools require 8-bit non-interlaced PNG; explicitly convert a copy first');
    const bytes = Buffer.alloc(size + 1); let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total !== size || !bytes.subarray(0, 33).equals(header)) throw inputError('PNG changed during read');
    // Reject APNG before decoding; frame selection must never be implicit.
    let ended = false;
    for (let at = 8; at < size;) {
      if (at + 12 > size) throw inputError('Truncated PNG chunk');
      const length = bytes.readUInt32BE(at); const type = bytes.toString('ascii', at + 4, at + 8);
      if (length > size - at - 12) throw inputError('Invalid PNG chunk length');
      if (type === 'IHDR' && at !== 8) throw inputError('Duplicate PNG header is not allowed');
      if (type === 'acTL') throw inputError('Animated PNG is not supported by technique tools');
      if (type === 'IEND') {
        if (length !== 0 || at + 12 !== size) throw inputError('PNG end marker must terminate the input');
        ended = true;
      }
      at += length + 12;
    }
    if (!ended) throw inputError('PNG is missing its end marker');
    let decoded;
    try { decoded = png.read(bytes.subarray(0, size), { checkCRC: true }); }
    catch { throw inputError('PNG could not be decoded or failed its checksum'); }
    return { width, height, data: decoded.data, bytes: bytes.subarray(0, size) };
  } finally { await handle.close(); }
}

export async function writePng(file, image) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, png.write(image, { colorType: 6, inputColorType: 6, bitDepth: 8 }), { flag: 'wx', mode: 0o600 });
  try { await link(temporary, file); }
  finally { await unlink(temporary).catch(() => {}); }
}

export function nearest(image, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.floor(y * image.height / height);
    for (let x = 0; x < width; x++) {
      const source = (sourceY * image.width + Math.floor(x * image.width / width)) * 4;
      data.set(image.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function cropPadded(image, tile, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < tile.height; y++) {
    const start = ((tile.y + y) * image.width + tile.x) * 4;
    image.data.copy(data, y * width * 4, start, start + tile.width * 4);
  }
  return { width, height, data };
}

function boxBlur(source, width, height, radius, horizontal) {
  const result = new Float32Array(source.length);
  const lines = horizontal ? height : width; const size = horizontal ? width : height;
  const index = (line, p, c) => (horizontal ? line * width + p : p * width + line) * 4 + c;
  for (let line = 0; line < lines; line++) for (let c = 0; c < 4; c++) {
    let sum = 0;
    for (let p = -radius; p <= radius; p++) sum += source[index(line, Math.max(0, Math.min(size - 1, p)), c)];
    for (let p = 0; p < size; p++) {
      result[index(line, p, c)] = sum / (radius * 2 + 1);
      sum += source[index(line, Math.min(size - 1, p + radius + 1), c)] - source[index(line, Math.max(0, p - radius), c)];
    }
  }
  return result;
}

function lowFrequency(image, alpha, sigma) {
  let data = new Float32Array(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const weight = alpha[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[i + c] = image.data[i + c] * weight;
    data[i + 3] = weight;
  }
  const ideal = Math.sqrt(4 * sigma * sigma + 1);
  let lower = Math.floor(ideal); if (lower % 2 === 0) lower--;
  const count = Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
  // Three separable box passes approximate a Gaussian without a native dependency.
  for (let pass = 0; pass < 3; pass++) {
    const radius = ((pass < count ? lower : lower + 2) - 1) / 2;
    if (radius) data = boxBlur(boxBlur(data, image.width, image.height, radius, true), image.width, image.height, radius, false);
  }
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) {
    for (let c = 0; c < 3; c++) data[i + c] /= data[i + 3];
  }
  return data;
}

export function restoreColors(original, edited, sigma) {
  if (sigma === 0) return edited;
  const base = lowFrequency(original, original.data, sigma);
  const detail = lowFrequency(edited, original.data, sigma);
  const data = Buffer.from(edited.data);
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) {
    data[i + c] = original.data[i + 3] === 0 ? original.data[i + c] : Math.max(0, Math.min(255, Math.round(base[i + c] + edited.data[i + c] - detail[i + c])));
  }
  return { width: original.width, height: original.height, data };
}
