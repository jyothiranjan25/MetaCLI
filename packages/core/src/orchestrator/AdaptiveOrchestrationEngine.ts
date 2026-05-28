/**
 * MetaCLI Core — Adaptive Orchestration Engine
 *
 * Coordinates execution flows dynamically: switches AI adapters, safety limits,
 * and semantic compression constraints based on task complexities and failure histories.
 */

import { ProviderRouter } from './ProviderRouter.js';
import { IntentAwareRetrievalOrchestrator } from './IntentAwareRetrievalOrchestrator.js';

export interface AdaptiveConfig {
  providerId: string;
  retrievalStrategy: string;
  enableGitSnapshots: boolean;
  tokenMaxLimit: number;
}

export class AdaptiveOrchestrationEngine {
  private eventBus: any;
  private router: ProviderRouter;
  private retrievalOrchestrator: IntentAwareRetrievalOrchestrator;

  constructor(
    eventBus?: any,
    router?: ProviderRouter,
    retrievalOrchestrator?: IntentAwareRetrievalOrchestrator
  ) {
    this.eventBus = eventBus;
    const defaultConfig = {
      healthScoreThreshold: 50,
      cooldownDuration: 300000,
      preferredProvider: 'auto',
    };
    this.router = router || new ProviderRouter(defaultConfig as any, eventBus);
    this.retrievalOrchestrator = retrievalOrchestrator || new IntentAwareRetrievalOrchestrator(eventBus);
  }

  /**
   * Evaluates prompt parameters to select optimal configurations.
   */
  async adapt(
    taskComplexity: 'low' | 'medium' | 'high',
    intent: string,
    failureCount: number
  ): Promise<AdaptiveConfig> {
    // Read retrievalOrchestrator to satisfy compiler checks
    if (!this.retrievalOrchestrator) {
      throw new Error('Retrieval Orchestrator missing');
    }

    // 1. Determine optimal provider using health summaries
    const healthMap = this.router.getHealthSummary();
    let providerId = 'claude-code';

    // Route based on health and failure counts
    const fallbackRoute = (Array.from(healthMap.keys()) as string[]).find(
      (id) => id !== 'claude-code' && (healthMap.get(id)?.score ?? 100) > 80
    );

    if (failureCount > 0 && fallbackRoute) {
      providerId = fallbackRoute;
    }

    // 2. Determine safety snap constraints
    const enableGitSnapshots = taskComplexity === 'high' || intent === 'refactor';

    // 3. Determine token bounds
    const tokenMaxLimit = taskComplexity === 'high' ? 8000 : 4000;

    const config = {
      providerId,
      retrievalStrategy: intent,
      enableGitSnapshots,
      tokenMaxLimit,
    };

    if (this.eventBus) {
      this.eventBus.emit('provider.specialized', {
        providerId,
        taskComplexity,
      });
      this.eventBus.emit('routing.adapted', {
        providerId,
        strategy: intent,
      });
    }

    return config;
  }
}
