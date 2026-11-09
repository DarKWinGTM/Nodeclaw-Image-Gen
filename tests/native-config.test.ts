import { expect, test } from 'claude-code/testing';

for (const options of [
  { api_base_url: 'https://plugin.example/first/v1', api_key: 'fixture-native-first' },
  { api_base_url: 'https://plugin.example/second/v1', api_key: "fixture-native-$(literal)'\"`" },
]) {
  test(`native configuration activation publishes ${options.api_base_url}`, { options }, async ($, on) => {
    const writes: { name: string; value?: string }[] = [];
    on('env.set', (_, event) => { writes.push(event); return { value: {} }; });
    on('session.start', () => ({ cwd: '/fixture' }));
    await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true });
    expect(writes.length).toBe(1);
    expect(writes[0].name).toBe('NODECLAW_IMAGE_GEN_PLUGIN_CONFIG');
    expect(JSON.parse(writes[0].value!)).toEqual({ apiBaseUrl: options.api_base_url, apiKey: options.api_key });
  });
}

for (const failure of ['engine-hold', 'hook-deny'] as const) {
  test(`native configuration ${failure} reports a sanitized application failure`, {
    options: { api_base_url: 'https://plugin.example/relay/v1', api_key: 'fixture-native-sensitive' },
  }, async ($, on) => {
    const messages: string[] = [];
    on('env.set', () => {
      if (failure === 'engine-hold') return { value: { deny: 'fixture-native-sensitive' } };
      return { deny: 'fixture-native-sensitive' };
    });
    on('ui.log', (_, event) => { messages.push(event.text); return { value: undefined }; });
    on('session.start', () => ({ cwd: '/fixture' }));
    expect(await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true })).toEqual({ cwd: '/fixture' });
    expect(messages.length).toBe(1);
    expect(messages[0].includes('could not be applied')).toBe(true);
    expect(messages[0].includes('fixture-native-sensitive')).toBe(false);
  });
}
