import { apiUrl } from './config.mjs';
import { requestJson } from './http.mjs';

export async function discoverModels(endpoint, { signal, env = process.env, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const merged = new Map(); const issues = []; let usable = 0;
  function accept(id, source, item = {}) {
    if (typeof id !== 'string' || !id.trim()) return;
    const model = merged.get(id) || { id, endpoint: endpoint.baseUrl, sources: [], pairs: [], operations: [] };
    if (!model.sources.includes(source)) model.sources.push(source);
    if (source === 'catalog') {
      model.pairs = Array.isArray(item.operationCompatibilities) ? item.operationCompatibilities.filter(p => typeof p.operation === 'string' && typeof p.compatibilityKey === 'string') : [];
      model.operations = Array.isArray(item.operations) ? item.operations : [];
    }
    merged.set(id, model);
  }
  if (endpoint.catalogUrl) {
    try {
      const { data } = await requestJson(endpoint.catalogUrl, { signal, fetchImpl, timeoutMs, limit: 4194304 });
      const models = data?.data?.snapshot?.models;
      if (!Array.isArray(models)) throw new Error('Catalog schema unavailable');
      usable++;
      for (const model of models) accept(model.modelId, 'catalog', model);
    } catch (error) { issues.push({ source: 'catalog', code: error.code || 'catalog_unavailable' }); }
  }
  try {
    const { data } = await requestJson(apiUrl(endpoint, 'models'), { endpoint, env, signal, fetchImpl, timeoutMs, limit: 4194304, authenticated: Boolean(endpoint.apiKeyEnv && env[endpoint.apiKeyEnv]) });
    if (!Array.isArray(data?.data)) throw new Error('Models schema unavailable');
    usable++;
    for (const model of data.data) accept(model.id, 'models');
  } catch (error) { issues.push({ source: 'models', code: error.code || 'catalog_unavailable' }); }
  return { endpoint: endpoint.baseUrl, status: usable ? 'listed' : 'catalog_unavailable', models: [...merged.values()], issues };
}
