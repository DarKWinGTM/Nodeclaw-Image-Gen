#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, resolveContext, inputError } from './config.mjs';
import { discoverModels } from './models.mjs';

const stringOptions = ['config', 'provider', 'model', 'method', 'api-base-url', 'catalog-url', 'api-docs-url', 'api-key-env', 'output-dir', 'output', 'harness', 'harness-endpoint', 'harness-api-key-env', 'harness-provider', 'fallback', 'fallback-terminal', 'request-ms', 'wait-ms', 'poll-interval-ms', 'max-response-bytes', 'prompt', 'mask', 'reference-url', 'compatibility-key', 'size', 'quality', 'format', 'response-format', 'n', 'spec', 'request-json', 'handle', 'target', 'version', 'manifest', 'assets-dir', 'repository', 'release'];
const booleanOptions = ['json', 'yes', 'dry-run', 'allow-local-http', 'skip-discovery', 'help', 'replace'];
const camel = value => value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export async function main(argv = process.argv.slice(2)) {
  const options = Object.fromEntries([...stringOptions.map(k => [k, { type: 'string' }]), ...booleanOptions.map(k => [k, { type: 'boolean' }]), ['image', { type: 'string', multiple: true }]]);
  let parsed;
  try { parsed = parseArgs({ args: argv, options, allowPositionals: true }); }
  catch { throw inputError('Unknown/malformed argument; use --help for supported options'); }
  let cli = Object.fromEntries(Object.entries(parsed.values).map(([k, v]) => [camel(k), v]));
  const [command = 'help', subcommand, id] = parsed.positionals;
  cli.command = command;
  if (cli.help || command === 'help') {
    console.log(`Nodeclaw-Image-Gen\n\nCommands: setup, models, generate, edit, resume, styles, techniques, docs, update\n\n  setup [--config FILE]\n  models [--api-base-url URL] [--json]\n  generate --prompt TEXT [--dry-run | --yes] [--method task|direct]\n  edit --prompt TEXT --image FILE [--image FILE] [--mask FILE] [--dry-run | --yes]\n  resume --handle FILE [--json]\n  styles|techniques list|show|sync [ID] [--manifest FILE --assets-dir DIR --yes]\n  docs fetch|sync\n  update check|apply [--manifest FILE --assets-dir DIR --target DIR --yes]\n\nCommon: --config FILE --model ID --api-base-url URL --provider nodeclaw|openai-compatible\n        --api-key-env ENV_NAME --output-dir DIR --output FILE --fallback true|false\n        --spec FILE --request-json FILE --size WxH --quality VALUE --format png|jpeg|webp\n        --json (stdout result only; progress stderr), --allow-local-http (loopback only)\n\nCredentials: set NODECLAW_API_KEY or the configured environment variable securely.\nTask-first by default. --yes explicitly authorizes the selected request; dry-run never generates.\nTechnique workflows are read by your existing text model, not executed as downloaded code.`);
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 22) throw inputError('Node.js 22 or newer is required');
  const specInput = cli.spec ? await readJsonInput(cli.spec) : {};
  cli = { ...specInput, ...cli, yes: parsed.values.yes === true };
  const context = await resolveContext({ cli });
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);
  let result;
  try {
  if (command === 'setup') {
    await mkdir(path.dirname(context.configPath), { recursive: true, mode: 0o700 });
    const selected = { ...context.config, outputDir: cli.outputDir || DEFAULTS.outputDir };
    await writeFile(context.configPath, `${JSON.stringify(selected, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    result = { status: 'configured', configPath: context.configPath, apiKeyEnv: DEFAULTS.apiKeyEnv };
  } else if (command === 'models') {
    const views = [];
    for (const endpoint of context.endpoints) views.push(await discoverModels(endpoint));
    result = { status: 'inspected', endpoints: views, manualModelAllowed: true, preferredModel: context.config.model };
  } else if (command === 'generate' || command === 'edit') {
    let spec = { ...specInput };
    let request;
    if (cli.requestJson) request = await readJsonInput(cli.requestJson);
    spec = { ...spec, ...Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined)), operation: command === 'edit' ? 'image_edit' : 'image_generation' };
    if (request) spec.request = request;
    const { planImageRequest, executeDirect, describePlan } = await import('./images.mjs');
    const plan = await planImageRequest(context, spec);
    if (cli.dryRun) result = { status: 'prepared', ...describePlan(plan) };
    else {
      if (!cli.yes) throw inputError('Review --dry-run, then explicitly pass --yes to submit the request');
      if (plan.method === 'task') {
        const { runTask } = await import('./tasks.mjs');
        result = await runTask(plan, { signal: controller.signal });
      } else result = await executeDirect(plan, { signal: controller.signal });
    }
  } else if (command === 'resume') {
    if (!cli.handle) throw inputError('resume requires --handle FILE');
    const { resumeTask } = await import('./tasks.mjs');
    result = await resumeTask(path.resolve(cli.handle), context, { signal: controller.signal });
  } else if (['styles', 'techniques', 'docs'].includes(command)) {
    const { contentCommand } = await import('./content.mjs');
    result = await contentCommand(command, subcommand || 'list', id, context, cli);
  } else if (command === 'update') {
    const { updateCommand } = await import('./distribution.mjs');
    result = await updateCommand(subcommand || 'check', context, cli);
  } else throw inputError('Unknown command; use --help');
  console.log(JSON.stringify(result, null, cli.json ? undefined : 2));
  process.exitCode = ({ pending: 3, outcome_unknown: 4, failed: 1, save_failed: 1 })[result?.status] || 0;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
  }
}

async function readJsonInput(file) {
  const { stat } = await import('node:fs/promises');
  if ((await stat(file)).size > 34 * 1024 * 1024) throw inputError('JSON input exceeds 34 MiB');
  let value;
  try { value = JSON.parse(await readFile(file, 'utf8')); } catch { throw inputError('Input file must contain valid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw inputError('Input must be a JSON object');
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    const known = error.exitCode || error.code;
    console.log(JSON.stringify({ status: 'failed', error: { code: error.code || 'client_error', message: known && !['EACCES', 'ENOENT', 'EEXIST'].includes(error.code) ? error.message : 'Client operation failed; check input, permissions and existing target files' } }));
    process.exitCode = error.exitCode || 1;
  });
}
