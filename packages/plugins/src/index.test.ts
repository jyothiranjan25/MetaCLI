import { describe, it, expect } from 'vitest';
import { PluginSDK, type MetaCLIPlugin, type PluginContext } from './index.js';

describe('MetaCLI Plugin SDK', () => {
  it('should support plugin registration, lifecycle onLoad triggers, capabilities injection, and clean unloads', async () => {
    const logs: string[] = [];
    const context: PluginContext = {
      eventBus: {},
      telemetry: {},
      logger: {
        info: (msg) => logs.push(`INFO: ${msg}`),
        warn: (msg) => logs.push(`WARN: ${msg}`),
        error: (msg) => logs.push(`ERROR: ${msg}`),
      },
    };

    const sdk = new PluginSDK(context);

    let loaded = false;
    let unloaded = false;

    const testPlugin: MetaCLIPlugin = {
      id: 'plugin-slack-alerts',
      version: '1.2.0',
      onLoad: async (ctx) => {
        loaded = true;
        ctx.logger.info('Initializing Slack hooks...');
      },
      onUnload: async () => {
        unloaded = true;
      },
    };

    // 1. Register plugin and verify onLoad trigger
    await sdk.registerPlugin(testPlugin);
    expect(loaded).toBe(true);
    expect(sdk.getPlugins().length).toBe(1);
    expect(sdk.getPlugins()[0].id).toBe('plugin-slack-alerts');
    expect(logs).toContain('INFO: Successfully loaded plugin: plugin-slack-alerts [v1.2.0]');

    // 2. Prevent duplicate registrations
    await sdk.registerPlugin(testPlugin);
    expect(logs).toContain('WARN: Plugin with ID "plugin-slack-alerts" is already registered.');

    // 3. Unload and verify onUnload trigger
    await sdk.unregisterPlugin('plugin-slack-alerts');
    expect(unloaded).toBe(true);
    expect(sdk.getPlugins().length).toBe(0);
  });
});
