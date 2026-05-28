/**
 * MetaCLI CLI — Bootstrap
 *
 * Initializes the Orchestrator with all registered adapters
 * and system configuration. Used by all commands.
 */

import {
  Orchestrator,
  ConfigLoader,
  EventBus,
  type MetaCLIConfig,
  type MetaCLIEvents,
} from '@metacli/core';
import { ClaudeAdapter, GeminiAdapter } from '@metacli/adapters';
import { UsageTracker, HealthScorer, CooldownManager } from '@metacli/telemetry';
import path from 'node:path';
import fs from 'node:fs';

export interface BootstrapResult {
  orchestrator: Orchestrator;
  config: MetaCLIConfig;
  eventBus: EventBus<MetaCLIEvents>;
  usageTracker: UsageTracker;
  healthScorer: HealthScorer;
  cooldownManager: CooldownManager;
}

export async function bootstrap(cwd?: string): Promise<BootstrapResult> {
  // 1. Load configuration
  const configLoader = new ConfigLoader();
  const config = await configLoader.load(cwd);

  // 2. Create the event bus
  const eventBus = new EventBus<MetaCLIEvents>();

  // 3. Initialize the orchestrator
  const orchestrator = new Orchestrator(config, eventBus);

  // 4. Register all built-in adapters
  const adapters = [new ClaudeAdapter(), new GeminiAdapter()];

  for (const adapter of adapters) {
    const providerConfig = config.providers[adapter.id];

    // Skip explicitly disabled providers
    if (providerConfig?.enabled === false) continue;

    orchestrator.registerAdapter(adapter);
  }

  // 5. Initialize telemetry
  const usageTracker = new UsageTracker(eventBus);
  const healthScorer = new HealthScorer(eventBus);
  const cooldownManager = new CooldownManager(eventBus);

  return {
    orchestrator,
    config,
    eventBus,
    usageTracker,
    healthScorer,
    cooldownManager,
  };
}

/**
 * Creates a context resolver function that dynamically loads the project brain
 * and extracts context matching the prompt query if brain.db exists.
 */
export function createContextResolver(workingDirectory: string): (prompt: string) => Promise<string | null> {
  return async (prompt: string): Promise<string | null> => {
    try {
      const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
      if (fs.existsSync(dbPath)) {
        const { BrainStore, KeywordRetrievalEngine } = await import('@metacli/brain');
        const store = new BrainStore(workingDirectory);
        const engine = new KeywordRetrievalEngine(store, workingDirectory);
        const result = engine.retrieveContext(prompt);
        store.close();
        return result.markdown || null;
      }
    } catch (error) {
      // Safe fallback — ignore resolver error to not block core execution
    }
    return null;
  };
}
