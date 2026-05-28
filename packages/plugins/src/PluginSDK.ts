/**
 * @metacli/plugins — Extensibility Plugin SDK
 *
 * Implements standard plugin loading interfaces, capability injection
 * registries, lifecycle event hooks, and event-driven pipeline subscriptions.
 */

export interface PluginContext {
  eventBus: any;
  telemetry: any;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface MetaCLIPlugin {
  id: string;
  version: string;
  onLoad(ctx: PluginContext): void | Promise<void>;
  onUnload?(): void | Promise<void>;
}

export class PluginSDK {
  private plugins = new Map<string, MetaCLIPlugin>();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Registers and initializes an extensibility plugin.
   */
  async registerPlugin(plugin: MetaCLIPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      this.context.logger.warn(`Plugin with ID "${plugin.id}" is already registered.`);
      return;
    }

    try {
      await plugin.onLoad(this.context);
      this.plugins.set(plugin.id, plugin);
      this.context.logger.info(`Successfully loaded plugin: ${plugin.id} [v${plugin.version}]`);
    } catch (err: any) {
      this.context.logger.error(`Failed to load plugin "${plugin.id}": ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Unregisters and unloads a plugin.
   */
  async unregisterPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    if (plugin.onUnload) {
      try {
        await plugin.onUnload();
      } catch (err: any) {
        this.context.logger.error(`Error unloading plugin "${id}": ${err?.message || err}`);
      }
    }

    this.plugins.delete(id);
    this.context.logger.info(`Successfully unloaded plugin: ${id}`);
  }

  /**
   * Gets a list of loaded plugins.
   */
  getPlugins(): MetaCLIPlugin[] {
    return Array.from(this.plugins.values());
  }
}
