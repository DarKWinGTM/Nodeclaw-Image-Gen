#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkill } from '../skills/nodeclaw-image-gen/scripts/distribution.mjs';

try {
  const { values } = parseArgs({ options: {
    harness: { type: 'string' }, scope: { type: 'string', default: 'user' }, target: { type: 'string' },
    yes: { type: 'boolean' }, replace: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node script/install.mjs --harness claude-code|codex [--scope user|project] [--target DIR] [--yes] [--replace]\nWithout --yes, prints a preview only. Grok Bot requires an explicit supported import mechanism; no guessed install path.');
  } else {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required');
    if (!['user', 'project'].includes(values.scope)) throw new Error('scope must be user or project');
    const harness = values.harness;
    if (!values.target && !['claude-code', 'codex'].includes(harness)) throw new Error('Choose --harness claude-code|codex or an explicit --target');
    const base = values.scope === 'project' ? process.cwd() : os.homedir();
    const targetDir = path.resolve(values.target || path.join(base, harness === 'codex' ? '.agents' : '.claude', 'skills', 'nodeclaw-image-gen'));
    const sourceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/nodeclaw-image-gen');
    if (!values.yes) console.log(JSON.stringify({ status: 'prepared', source: sourceDir, target: targetDir, harness, scope: values.scope, requires: '--yes', replacementRequires: '--replace' }, null, 2));
    else console.log(JSON.stringify(await installSkill({ sourceDir, targetDir, replaceConfirmed: values.replace }), null, 2));
  }
} catch (error) {
  console.error(error.code === 'invalid_input' || !error.code ? error.message : 'Installation failed; check permissions, ownership and the existing target');
  process.exitCode = 2;
}
