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
  GlobalStorage,
  SetupManager,
  type MetaCLIConfig,
  type MetaCLIEvents,
} from '@metacli/core';
import { ClaudeAdapter, GeminiAdapter, CodexAdapter, OpenCodeAdapter, ProviderDiscovery } from '@metacli/adapters';
import { UsageTracker, HealthScorer, CooldownManager } from '@metacli/telemetry';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';

export interface BootstrapResult {
  orchestrator: Orchestrator;
  config: MetaCLIConfig;
  eventBus: EventBus<MetaCLIEvents>;
  usageTracker: UsageTracker;
  healthScorer: HealthScorer;
  cooldownManager: CooldownManager;
  storage: GlobalStorage;
}

export async function bootstrap(cwd: string = process.cwd()): Promise<BootstrapResult> {
  // 1. Initialize Global Storage & Event Bus
  const storage = new GlobalStorage();
  const eventBus = new EventBus<MetaCLIEvents>();
  
  // 2. Run initial setup if needed
  const setupManager = new SetupManager(storage, eventBus);
  const setupResult = await setupManager.runSetup();
  
  if (setupResult.isFirstTime && !process.env.METACLI_SKIP_SETUP) {
    console.log(chalk.bold.cyan('\nMetaCLI — First-time Initialization\n'));
    // We don't block, but we can emit or log that we're setting up
  }

  // 3. Load configuration
  const configLoader = new ConfigLoader();
  const config = await configLoader.load(cwd);

  // 4. Initialize the orchestrator
  const orchestrator = new Orchestrator(config, eventBus);

  // 5. Discover and register adapters
  const discovery = new ProviderDiscovery();
  const discovered = await discovery.discoverAll();

  // Mapping discovered providers to adapter classes
  const ADAPTER_MAP: Record<string, any> = {
    claude: ClaudeAdapter,
    gemini: GeminiAdapter,
    codex: CodexAdapter,
    opencode: OpenCodeAdapter,
  };

  for (const provider of discovered) {
    if (provider.isInstalled && ADAPTER_MAP[provider.id]) {
      const AdapterClass = ADAPTER_MAP[provider.id];
      const adapter = new AdapterClass();
      
      const providerConfig = config.providers[adapter.id];
      if (providerConfig?.enabled !== false) {
        orchestrator.registerAdapter(adapter);
      }
    }
  }

  // 6. Initialize telemetry
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
    storage,
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
