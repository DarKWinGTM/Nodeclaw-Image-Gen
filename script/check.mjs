import { readdir, readFile, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let scripts = 0; let json = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Source payload cannot contain symlinks');
    if (entry.isDirectory()) await check(file);
    else if (entry.name.endsWith('.mjs')) {
      const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 10000, maxBuffer: 16384 });
      if (run.status !== 0) throw new Error(run.stderr || 'Syntax check failed');
      scripts++;
    } else if (entry.name.endsWith('.json')) {
      if ((await lstat(file)).size > 1048576) throw new Error('Source JSON exceeds expected size');
      JSON.parse(await readFile(file, 'utf8')); json++;
    }
  }
}
await check(root);
console.log(JSON.stringify({ status: 'checked', scope: 'ESM syntax and source JSON', scripts, json }));
