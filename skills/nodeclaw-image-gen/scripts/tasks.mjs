import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { apiUrl, inputError, validateUrl } from './config.mjs';
import { authorization, requestJson, retryDelay } from './http.mjs';
import { atomicJson, readJsonFile, saveImages } from './output.mjs';
import { encodeRequest, describePlan, executeDirect } from './images.mjs';

const active = new Set(['queued', 'processing', 'reconciling']);

function validTask(data) {
  if (!data || typeof data.taskId !== 'string' || !/^req-(?:0|[1-9]\d{0,18})-[a-f0-9]{32}$/.test(data.taskId) || ![...active, 'succeeded', 'failed', 'expired'].includes(data.status)) throw new Error('Invalid Task projection');
  if (data.status === 'succeeded' && !data.result) throw new Error('Succeeded Task is missing result');
  return data;
}

async function finishTask(data, handle, handlePath, context, options) {
  const summary = { ...handle.summary, taskId: handle.taskId, handle: handlePath };
  if (data.status === 'succeeded') {
    const saved = await saveImages(data.result, handle.outputIntent, { ...options, stateDir: context.stateDir });
    if (saved.status === 'saved') {
      handle.completed = { ...summary, ...saved };
      await atomicJson(handlePath, handle);
    }
    return { ...summary, ...saved, ...(saved.status === 'saved' ? { handle: handlePath } : {}) };
  }
  return { ...summary, status: 'failed', taskStatus: data.status,
    error: { code: data.error?.code && /^[a-z0-9_:-]{1,80}$/i.test(data.error.code) ? data.error.code : 'task_failed', message: 'Task ended without an image result; failure/expiry does not establish no charge' } };
}

async function followTask(initial, handle, handlePath, context, options) {
  const deadline = Date.now() + context.config.timeouts.waitMs;
  const { env = context.env || process.env, signal, fetchImpl = fetch } = options;
  let data = initial?.data; let response = initial?.response; let failures = 0;
  const summary = () => ({ ...handle.summary, taskId: handle.taskId, handle: handlePath });
  for (;;) {
    if (data) {
      try { validTask(data); } catch { return { ...summary(), status: 'outcome_unknown', error: { code: 'invalid_task_response', message: 'Task completion was not established; resume the saved identity' } }; }
      if (handle.taskId && handle.taskId !== data.taskId) return { ...summary(), status: 'outcome_unknown', error: { code: 'task_identity_mismatch', message: 'Task read returned a different identity' } };
      handle.taskId = data.taskId;
      await atomicJson(handlePath, handle);
      if (!active.has(data.status)) return finishTask(data, handle, handlePath, context, options);
    }
    const delay = data ? retryDelay(response?.headers.get('retry-after'), context.config.timeouts.pollIntervalMs) : 0;
    if (signal?.aborted || Date.now() + delay >= deadline) return { ...summary(), status: handle.taskId ? 'pending' : 'outcome_unknown' };
    if (delay) { try { await wait(delay, undefined, { signal }); } catch { return { ...summary(), status: handle.taskId ? 'pending' : 'outcome_unknown' }; } }
    try {
      const headers = handle.taskId ? {} : { 'request-signature': handle.signature };
      const route = handle.taskId ? `media/tasks/${encodeURIComponent(handle.taskId)}` : 'media/tasks';
      const next = await requestJson(apiUrl(handle.endpoint, route), { endpoint: handle.endpoint, env, signal, fetchImpl, headers, authenticated: true,
        timeoutMs: Math.max(1, Math.min(context.config.timeouts.requestMs, deadline - Date.now())), limit: context.config.maxResponseBytes });
      data = next.data; response = next.response; failures = 0;
    } catch (error) {
      if ([401,403].includes(error.httpStatus)) return { ...summary(), status: 'failed', error: { code: error.code, message: 'Task read requires the original authorized account/key' } };
      if (!handle.taskId || error.httpStatus === 404 || ++failures > 2 || signal?.aborted) return { ...summary(), status: handle.taskId ? 'pending' : 'outcome_unknown', error: { code: 'task_read_unavailable', message: 'Read the saved Task identity again; no inference was replayed' } };
      const backoff = retryDelay(error.retryAfter, 1000 * failures);
      if (Date.now() + backoff >= deadline) return { ...summary(), status: 'pending' };
      try { await wait(backoff, undefined, { signal }); } catch { return { ...summary(), status: 'pending' }; }
      data = undefined;
    }
  }
}

export async function runTask(plan, { signal, env = plan.context.env || process.env, fetchImpl = fetch } = {}) {
  if (plan.method === 'direct') return executeDirect(plan, { signal, env, fetchImpl });
  authorization(plan.endpoint, env);
  const encoded = await encodeRequest(plan, true);
  const signature = randomUUID();
  const handlePath = path.join(plan.context.stateDir, 'tasks', `${signature}.json`);
  const handle = { schemaVersion: 1, kind: 'image-task', signature, endpoint: plan.endpoint,
    operation: plan.operation, model: plan.model, outputIntent: plan.outputIntent, summary: describePlan(plan) };
  await atomicJson(handlePath, handle, { exclusive: true });
  let initial;
  try {
    initial = await requestJson(apiUrl(plan.endpoint, 'media/tasks'), { endpoint: plan.endpoint, env, signal, fetchImpl, method: 'POST', body: encoded.body,
      headers: { ...encoded.headers, 'request-signature': signature }, authenticated: true, timeoutMs: plan.context.config.timeouts.requestMs, limit: plan.context.config.maxResponseBytes });
  } catch (error) {
    if (error.httpStatus >= 400 && error.httpStatus < 500) {
      return { ...handle.summary, status: 'failed', handle: handlePath, error: { code: error.code, message: 'Task request was rejected; no alternate inference was attempted' } };
    }
    // An uncertain POST is resolved by GET, never retried or switched to Direct.
    return followTask(undefined, handle, handlePath, plan.context, { signal, env, fetchImpl });
  }
  const result = await followTask(initial, handle, handlePath, plan.context, { signal, env, fetchImpl });
  if (result.taskStatus === 'failed' && plan.context.config.fallback.enabled && plan.context.config.fallback.onTerminalFailure) {
    console.error('Terminal reattempt not performed: public Task error categories do not establish retry eligibility. Review the saved Task before authorizing a new request.');
  }
  return result;
}

export async function resumeTask(handlePath, context, { signal, env = context.env || process.env, fetchImpl = fetch } = {}) {
  let handle;
  try { handle = await readJsonFile(handlePath, context.config.maxResponseBytes + 1048576); }
  catch { throw inputError('Cannot read the selected resume handle'); }
  if (handle.kind === 'image-result' && handle.schemaVersion === 1) {
    return saveImages(handle.result, handle.outputIntent, { signal, fetchImpl, stateDir: context.stateDir, priorPaths: handle.paths, recoveryFile: handlePath });
  }
  if (handle.kind !== 'image-task' || handle.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/.test(handle.signature)) throw inputError('Unsupported resume handle');
  const baseUrl = validateUrl(handle.endpoint?.baseUrl, context.config);
  const endpoint = context.endpoints.find(candidate => candidate.baseUrl === baseUrl);
  if (!endpoint) throw inputError('Resume endpoint is not a current trusted candidate; explicitly configure the original endpoint and its key binding');
  handle.endpoint = endpoint;
  if (handle.completed) {
    const files = await Promise.all(handle.completed.paths.map(file => stat(file).catch(() => null)));
    if (files.length && files.every(info => info?.isFile() && info.size > 0)) return handle.completed;
    delete handle.completed;
  }
  authorization(handle.endpoint, env);
  return followTask(undefined, handle, handlePath, context, { signal, env, fetchImpl });
}
