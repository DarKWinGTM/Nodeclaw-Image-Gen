export function register(on, options) {
  on('session.start', async ($, event, next) => {
    try {
      const result = await $.env.set('NODECLAW_IMAGE_GEN_PLUGIN_CONFIG', JSON.stringify({
        apiBaseUrl: options.api_base_url,
        apiKey: options.api_key,
      }));
      if (result.deny) throw new Error();
    } catch {
      $.ui.log('Native image configuration could not be applied; check plugin configuration and reload. No credential was printed.');
    }
    return next(event);
  });
}
