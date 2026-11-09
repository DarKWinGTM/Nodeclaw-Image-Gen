#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkill } from '../skills/nodeclaw-image-gen/scripts/distribution.mjs';
import { resolveContext, readSetupInput, saveConfiguration, inputError } from '../skills/nodeclaw-image-gen/scripts/config.mjs';

try {
  const { values } = parseArgs({ options: {
    harness: { type: 'string' }, scope: { type: 'string', default: 'user' }, target: { type: 'string' },
    yes: { type: 'boolean' }, replace: { type: 'boolean' }, help: { type: 'boolean' },
    config: { type: 'string' }, 'api-base-url': { type: 'string' }, 'api-key': { type: 'string' },
    'api-key-stdin': { type: 'boolean' }, interactive: { type: 'boolean' }, 'replace-config': { type: 'boolean' },
    provider: { type: 'string' }, model: { type: 'string' }, method: { type: 'string' },
    'api-mode': { type: 'string' }, 'endpoint-mode': { type: 'string' },
  } });
  if (values.help) {
    console.log('node script/install.mjs --harness claude-code|codex [--scope user|project] [--target DIR] [--yes] [--replace]\n  [--api-base-url URL] [--interactive | --api-key-stdin | --api-key KEY] [--config FILE] [--replace-config]\n  [--model ID] [--provider auto|nodeclaw|openai-compatible] [--api-mode images|gemini]\nWithout --yes, prints a preview only: no key prompt, stdin read or config write.\nUse --interactive locally for hidden key entry. Direct key arguments can appear in shell history/process listings.\nPrivate config is plaintext outside the installed skill; --replace-config is separate from install --replace.\nGrok Bot requires an explicit supported import mechanism; no guessed install path.');
  } else {
    if (Number(process.versions.node.split('.')[0]) < 22) throw inputError('Node.js 22 or newer is required');
    if (!['user', 'project'].includes(values.scope)) throw inputError('scope must be user or project');
    const harness = values.harness;
    if (!values.target && !['claude-code', 'codex'].includes(harness)) throw inputError('Choose --harness claude-code|codex or an explicit --target');
    const base = values.scope === 'project' ? process.cwd() : os.homedir();
    const targetDir = path.resolve(values.target || path.join(base, harness === 'codex' ? '.agents' : '.claude', 'skills', 'nodeclaw-image-gen'));
    const sourceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/nodeclaw-image-gen');
    const wantsConfig = ['config', 'api-base-url', 'api-key', 'api-key-stdin', 'interactive', 'model', 'provider', 'method', 'api-mode', 'endpoint-mode'].some(key => values[key] !== undefined);
    let cli = { ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value])), command: 'setup', replace: values['replace-config'] };
    let context = wantsConfig ? await resolveContext({ cli }) : undefined;
    const configuration = context ? await saveConfiguration(context, cli, { preview: true }) : undefined;
    if (context && (context.configPath === targetDir || context.configPath.startsWith(`${targetDir}${path.sep}`))) throw inputError('User config must be outside the skill installation');
    if (!values.yes) console.log(JSON.stringify({ status: 'prepared', source: sourceDir, target: targetDir, harness, scope: values.scope,
      requires: '--yes', replacementRequires: '--replace', configuration,
      ...(configuration?.replacementRequired ? { configurationReplacementRequires: '--replace-config' } : {}) }, null, 2));
    else {
      if (configuration?.replacementRequired && !values['replace-config']) throw inputError('Existing config requires explicit --replace-config confirmation');
      if (context) {
        cli = await readSetupInput(cli.interactive ? { ...cli, apiBaseUrl: cli.apiBaseUrl || context.config.apiBaseUrl } : cli);
        context = await resolveContext({ cli });
      }
      const installed = await installSkill({ sourceDir, targetDir, replaceConfirmed: values.replace });
      if (context) {
        try { installed.configuration = await saveConfiguration(context, cli); }
        catch {
          installed.configuration = { status: 'failed', configPath: context.configPath, message: 'Skill installed, but configuration was not saved; retry local setup after checking the config target' };
          process.exitCode = 2;
        }
      }
      const runtime = ['node', path.join(targetDir, 'scripts/image-gen.mjs')];
      const selectedConfig = context ? ['--config', context.configPath] : [];
      installed.commands = {
        configure: [...runtime, 'setup', ...selectedConfig, '--interactive'],
        reconfigure: [...runtime, 'setup', ...selectedConfig, '--interactive', '--replace'],
        status: [...runtime, 'setup', ...selectedConfig, '--status', '--json'],
        checkUpdate: [...runtime, 'update', 'check'],
        update: [...runtime, 'update', 'apply', '--target', targetDir, '--yes'],
      };
      console.log(JSON.stringify(installed, null, 2));
    }
  }
} catch (error) {
  console.error(error.code === 'invalid_input' ? error.message : 'Installation failed; check arguments, permissions, ownership and the existing target');
  process.exitCode = 2;
}
