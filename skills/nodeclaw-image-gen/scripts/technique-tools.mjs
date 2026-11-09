import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inputError, parseBoolean } from './config.mjs';
import { atomicJson, readJsonFile } from './output.mjs';
import { readPng, writePng, nearest, cropPadded, restoreColors, MAX_PIXELS } from './raster.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const supported = ['pixel-art-detail', 'preserve-composition'];
const clamp = n => Math.max(0, Math.min(255, Math.round(n)));

function parameters(cli) {
  const scale = Number(cli.scale ?? 3); const overlap = Number(cli.overlap ?? 0.25);
  const size = /^(\d+)(?:x(\d+))?$/.exec(String(cli.tileSize ?? '1024'));
  const width = Number(size?.[1]); const height = Number(size?.[2] ?? size?.[1]);
  const colorSigma = Number(cli.colorSigma ?? 2);
  if (![2, 3].includes(scale) || !Number.isFinite(overlap) || overlap < 0 || overlap > 0.4 || !Number.isFinite(colorSigma) || colorSigma < 0 || colorSigma > 32) throw inputError('Use scale 2|3, overlap 0..0.4 and color-sigma 0..32');
  if (!size || width < scale || height < scale || width > 2048 || height > 2048) throw inputError('tile-size must be WxH (or one square side), between scale and 2048');
  return { scale, tileWidth: width, tileHeight: height, overlap, colorSigma, preserveAlpha: parseBoolean(cli.preserveAlpha ?? true, 'preserve-alpha') };
}

function pixelTiles(source, mask, p) {
  const width = source.width * p.scale; const height = source.height * p.scale;
  if (width * height > MAX_PIXELS) throw inputError('Scaled canvas exceeds 16 megapixels; choose a smaller source or scale');
  const strideX = Math.max(p.scale, Math.floor(p.tileWidth * (1 - p.overlap) / p.scale) * p.scale);
  const strideY = Math.max(p.scale, Math.floor(p.tileHeight * (1 - p.overlap) / p.scale) * p.scale);
  const xs = [0]; const ys = [0];
  while (xs.at(-1) + p.tileWidth < width) { xs.push(xs.at(-1) + strideX); if (xs.length > 64) throw inputError('Technique exceeds 64 tiles'); }
  while (ys.at(-1) + p.tileHeight < height) { ys.push(ys.at(-1) + strideY); if (ys.length * xs.length > 64) throw inputError('Technique exceeds 64 tiles'); }
  const tiles = [];
  for (const [row, y] of ys.entries()) for (const [column, x] of xs.entries()) {
    const id = `r${String(row).padStart(2, '0')}_c${String(column).padStart(2, '0')}`;
    const tile = { id, x, y, width: Math.min(p.tileWidth, width - x), height: Math.min(p.tileHeight, height - y),
      input: `inputs/${id}.png`, spec: `specs/${id}.json`, result: `edited/${id}.png` };
    if (mask) tile.mask = `masks/${id}.png`;
    let editable = false;
    for (let iy = y; iy < y + tile.height && !editable; iy += p.scale) for (let ix = x; ix < x + tile.width; ix += p.scale) {
      const at = (Math.floor(iy / p.scale) * source.width + Math.floor(ix / p.scale)) * 4;
      if (source.data[at + 3] > 0 && (!mask || mask.data[at + 3] < 255)) { editable = true; break; }
    }
    tile.skipped = !editable;
    tiles.push(tile);
  }
  return { target: { width, height }, stride: { x: strideX, y: strideY }, tiles };
}

function pixelPrompt(scale, extra) {
  return `This is a crop of a pixel-art picture enlarged ${scale}x. Refine it at exactly the same dimensions as crisp, finer pixel art. Keep every object's position, silhouette, composition, camera, colours and lighting. Do not add, remove or move objects. Preserve the original transparent background and the supplied mask. Do not introduce smooth painted antialiasing.${extra ? `\nAdditional direction: ${extra}` : ''}`;
}

async function prepare(id, context, cli) {
  if (!supported.includes(id)) throw inputError('No shipped tool for this technique; use techniques list');
  const images = Array.isArray(cli.image) ? cli.image : cli.image ? [cli.image] : [];
  if (images.length !== 1 || !cli.workDir) throw inputError('Technique preparation requires one --image PNG and a new --work-dir DIR');
  const source = await readPng(path.resolve(context.cwd, images[0]));
  const mask = cli.mask ? await readPng(path.resolve(context.cwd, cli.mask)) : undefined;
  if (mask && (mask.width !== source.width || mask.height !== source.height)) throw inputError('Protection/API mask dimensions must match the source');
  let p; let plan; let prompt;
  if (id === 'pixel-art-detail') {
    p = parameters(cli); plan = pixelTiles(source, mask, p); prompt = pixelPrompt(p.scale, cli.prompt);
  } else {
    const change = cli.change || cli.prompt;
    if (typeof change !== 'string' || !change.trim()) throw inputError('preserve-composition requires --change TEXT');
    prompt = `${change}\nPreserve composition, camera, object positions and silhouettes.${cli.preserve ? ` Also preserve: ${cli.preserve}.` : ''} Change only the selected elements; respect the supplied mask.`;
    p = { preserveAlpha: true };
    plan = { target: { width: source.width, height: source.height }, tiles: [{ id: 'composition', x: 0, y: 0, width: source.width, height: source.height, input: 'source.png', spec: 'specs/composition.json', result: 'edited/composition.png', skipped: false, ...(mask ? { mask: 'protection-mask.png' } : {}) }] };
  }
  if (Buffer.byteLength(prompt) > 65536) throw inputError('Technique prompt exceeds 64 KiB');
  const directory = path.resolve(context.cwd, cli.workDir);
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') throw inputError('Work directory already exists; choose a new directory'); throw error; }
  for (const name of ['inputs', 'specs', 'edited', ...(mask ? ['masks'] : [])]) await mkdir(path.join(directory, name), { mode: 0o700 });
  await writeFile(path.join(directory, 'source.png'), source.bytes, { flag: 'wx', mode: 0o600 });
  if (mask) await writeFile(path.join(directory, 'protection-mask.png'), mask.bytes, { flag: 'wx', mode: 0o600 });
  const job = { schemaVersion: 1, kind: 'image-technique', technique: id,
    source: { width: source.width, height: source.height, sha256: hash(source.bytes) },
    ...(mask ? { mask: { sha256: hash(mask.bytes) } } : {}), parameters: p, ...plan };
  const scaled = id === 'pixel-art-detail' ? nearest(source, plan.target.width, plan.target.height) : source;
  const scaledMask = mask && id === 'pixel-art-detail' ? nearest(mask, plan.target.width, plan.target.height) : mask;
  for (const tile of plan.tiles) {
    if (tile.skipped) continue;
    if (id === 'pixel-art-detail') {
      await writePng(path.join(directory, tile.input), cropPadded(scaled, tile, p.tileWidth, p.tileHeight));
      if (scaledMask) {
        const cropped = cropPadded(scaledMask, tile, p.tileWidth, p.tileHeight);
        for (let y = 0; y < p.tileHeight; y++) for (let x = 0; x < p.tileWidth; x++) {
          const at = (y * p.tileWidth + x) * 4;
          if (x >= tile.width || y >= tile.height) cropped.data[at + 3] = 255;
        }
        await writePng(path.join(directory, tile.mask), cropped);
      }
    }
    const spec = { operation: 'image_edit', image: [path.join(directory, tile.input)], prompt,
      n: 1, format: 'png', size: id === 'pixel-art-detail' ? `${p.tileWidth}x${p.tileHeight}` : `${source.width}x${source.height}`,
      output: path.join(directory, tile.result), ...(tile.mask ? { mask: path.join(directory, tile.mask) } : {}), ...(cli.model ? { model: cli.model } : {}) };
    await atomicJson(path.join(directory, tile.spec), spec, { exclusive: true });
  }
  const file = path.join(directory, 'job.json'); await atomicJson(file, job, { exclusive: true });
  return { status: 'prepared', technique: id, job: file, target: job.target, tileCount: plan.tiles.length,
    requestCount: plan.tiles.filter(tile => !tile.skipped).length, skipped: plan.tiles.filter(tile => tile.skipped).map(tile => tile.id),
    specs: plan.tiles.filter(tile => !tile.skipped).map(tile => path.join(directory, tile.spec)),
    paidRequestsSent: 0, next: 'Review the tile count, model and supported size, then authorize each existing edit --spec FILE --yes request. Keep each returned Task handle for resume.' };
}

async function loadJob(file) {
  const job = await readJsonFile(file, 524288);
  if (job?.schemaVersion !== 1 || job.kind !== 'image-technique' || !supported.includes(job.technique)) throw inputError('Unsupported technique job');
  const directory = path.dirname(path.resolve(file));
  const source = await readPng(path.join(directory, 'source.png'));
  if (hash(source.bytes) !== job.source?.sha256 || source.width !== job.source.width || source.height !== job.source.height) throw inputError('Source snapshot changed; do not reuse this job');
  const mask = job.mask ? await readPng(path.join(directory, 'protection-mask.png')) : undefined;
  if (mask && (hash(mask.bytes) !== job.mask.sha256 || mask.width !== source.width || mask.height !== source.height)) throw inputError('Protection-mask snapshot changed');
  let expected;
  if (job.technique === 'pixel-art-detail') {
    const p = job.parameters || {};
    const validated = parameters({ scale: p.scale, tileSize: `${p.tileWidth}x${p.tileHeight}`, overlap: p.overlap, colorSigma: p.colorSigma, preserveAlpha: p.preserveAlpha });
    if (JSON.stringify(validated) !== JSON.stringify(p)) throw inputError('Invalid saved technique parameters');
    expected = pixelTiles(source, mask, p);
  } else expected = { target: { width: source.width, height: source.height }, tiles: [{ id: 'composition', x: 0, y: 0, width: source.width, height: source.height, input: 'source.png', spec: 'specs/composition.json', result: 'edited/composition.png', skipped: false, ...(mask ? { mask: 'protection-mask.png' } : {}) }] };
  if (JSON.stringify(expected.target) !== JSON.stringify(job.target) || JSON.stringify(expected.tiles) !== JSON.stringify(job.tiles) || JSON.stringify(expected.stride) !== JSON.stringify(job.stride)) throw inputError('Saved tile geometry or paths differ from the canonical plan');
  return { job, directory, source, mask };
}

async function inspect(state) {
  const { job, directory, source, mask } = state; const missing = []; const invalid = []; const ready = []; const diagnostics = [];
  for (const tile of job.tiles) {
    if (tile.skipped) continue;
    const file = path.join(directory, tile.result);
    try {
      if (!(await lstat(file)).isFile()) throw inputError('Result must be an ordinary PNG file');
      const image = await readPng(file);
      const width = job.technique === 'pixel-art-detail' ? job.parameters.tileWidth : job.target.width;
      const height = job.technique === 'pixel-art-detail' ? job.parameters.tileHeight : job.target.height;
      if (image.width !== width || image.height !== height) throw inputError(`Expected ${width}x${height}; received ${image.width}x${image.height}. No automatic resize.`);
      let alphaChangedPixels = 0; let protectedPixelChanges = 0;
      const scale = job.technique === 'pixel-art-detail' ? job.parameters.scale : 1;
      for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) {
        const original = (Math.floor((tile.y + y) / scale) * source.width + Math.floor((tile.x + x) / scale)) * 4;
        const edited = (y * width + x) * 4;
        if (source.data[original + 3] !== image.data[edited + 3]) alphaChangedPixels++;
        if (mask?.data[original + 3] === 255 && !source.data.subarray(original, original + 4).equals(image.data.subarray(edited, edited + 4))) protectedPixelChanges++;
      }
      diagnostics.push({ id: tile.id, alphaChangedPixels, protectedPixelChanges });
      ready.push(tile.id);
    } catch (error) {
      if (error.code === 'ENOENT') missing.push(tile.id);
      else invalid.push({ id: tile.id, reason: error.code === 'invalid_input' ? error.message : 'Result could not be read' });
    }
  }
  return { status: missing.length || invalid.length ? 'incomplete' : 'ready', technique: job.technique,
    job: path.join(directory, 'job.json'), target: job.target, tileCount: job.tiles.length, ready, missing, invalid,
    skipped: job.tiles.filter(tile => tile.skipped).map(tile => tile.id), diagnostics, visualAcceptance: 'not_checked', paidRequestsSent: 0 };
}

async function merge(state, context, cli) {
  const { job, directory, source, mask } = state;
  if (job.technique !== 'pixel-art-detail') throw inputError('preserve-composition produces one Edit result; use check, not merge');
  const checked = await inspect(state);
  if (checked.status !== 'ready' && !cli.allowPartial) return { ...checked, paths: [] };
  const partial = checked.status !== 'ready'; const p = job.parameters;
  const base = nearest(source, job.target.width, job.target.height);
  const protectedPixels = mask && nearest(mask, job.target.width, job.target.height);
  const sums = new Float32Array(base.width * base.height * 5);
  for (const tile of job.tiles) {
    const original = cropPadded(base, tile, p.tileWidth, p.tileHeight);
    const edited = checked.ready.includes(tile.id) ? await readPng(path.join(directory, tile.result)) : original;
    if (edited.width !== p.tileWidth || edited.height !== p.tileHeight) throw inputError('Tile changed after check; no output written');
    const restored = edited === original ? original : restoreColors(original, edited, p.colorSigma * p.scale);
    const overlapX = p.tileWidth - job.stride.x; const overlapY = p.tileHeight - job.stride.y;
    for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) {
      const edgeX = Math.min(1, tile.x > 0 ? (x + 1) / (overlapX + 1) : 1, tile.x + p.tileWidth < base.width ? (tile.width - x) / (overlapX + 1) : 1);
      const edgeY = Math.min(1, tile.y > 0 ? (y + 1) / (overlapY + 1) : 1, tile.y + p.tileHeight < base.height ? (tile.height - y) / (overlapY + 1) : 1);
      const weight = edgeX * edgeY; const from = (y * p.tileWidth + x) * 4;
      const to = ((tile.y + y) * base.width + tile.x + x) * 5;
      for (let c = 0; c < 4; c++) sums[to + c] += restored.data[from + c] * weight;
      sums[to + 4] += weight;
    }
  }
  const data = Buffer.alloc(base.data.length);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 5) {
    const protection = protectedPixels ? protectedPixels.data[i + 3] / 255 : 0;
    for (let c = 0; c < 4; c++) {
      const original = base.data[i + c]; const blended = sums[j + c] / sums[j + 4];
      data[i + c] = (c === 3 && p.preserveAlpha) || (base.data[i + 3] === 0 && p.preserveAlpha) ? original : clamp(original * protection + blended * (1 - protection));
    }
  }
  const output = path.resolve(context.cwd, cli.outputDir || directory);
  const prefix = partial ? 'partial' : 'refined';
  const paths = [path.join(output, `${prefix}-hires.png`), path.join(output, `${prefix}-original-size.png`)];
  for (const file of paths) {
    try { await lstat(file); throw inputError('Output already exists; choose a new --output-dir'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(output, { recursive: true, mode: 0o700 });
  const hires = { width: base.width, height: base.height, data };
  const saved = [];
  try {
    await writePng(paths[0], hires); saved.push(paths[0]);
    await writePng(paths[1], nearest(hires, source.width, source.height)); saved.push(paths[1]);
  } catch { return { ...checked, status: 'save_failed', paths: saved, error: { code: 'output_write_failed', message: 'Some outputs could not be saved; keep saved files and choose a new output directory. No inference was sent.' } }; }
  return { ...checked, status: partial ? 'partial' : 'saved', paths: saved, preserveAlpha: p.preserveAlpha,
    colorRestoration: 'original low frequency plus edited signed detail; three-box Gaussian approximation', blend: 'linear_overlap', visualAcceptance: 'not_checked' };
}

export async function techniqueToolCommand(action, id, context, cli) {
  if (action === 'prepare') return prepare(id, context, cli);
  if (!cli.job) throw inputError('Technique check/merge requires --job FILE');
  const state = await loadJob(path.resolve(context.cwd, cli.job));
  if (id && id !== state.job.technique) throw inputError('Technique ID does not match the saved job');
  if (action === 'check') return inspect(state);
  if (action === 'merge') return merge(state, context, cli);
  throw inputError('Technique tools support prepare, check or merge');
}
