/**
 * MetaCLI Core — Intent-Aware Retrieval Orchestrator
 *
 * Automatically switches codebase context retrieval strategies depending on
 * whether the developer is refactoring, debugging, planning, or auditing.
 */

import { ContextItem } from './ContextOptimizer.js';
import { SemanticContextPrioritizer } from './SemanticContextPrioritizer.js';
import { RetrievalExplainabilityEngine } from './RetrievalExplainabilityEngine.js';

export interface RetrievalResult {
  items: ContextItem[];
  intent: string;
  strategyUsed: string;
  explanations: any[];
}

export class IntentAwareRetrievalOrchestrator {
  private eventBus: any;
  private prioritizer: SemanticContextPrioritizer;
  private explainabilityEngine: RetrievalExplainabilityEngine;

  constructor(
    eventBus?: any,
    prioritizer?: SemanticContextPrioritizer,
    explainabilityEngine?: RetrievalExplainabilityEngine
  ) {
    this.eventBus = eventBus;
    this.prioritizer = prioritizer || new SemanticContextPrioritizer(eventBus);
    this.explainabilityEngine = explainabilityEngine || new RetrievalExplainabilityEngine(eventBus);
  }

  /**
   * Orchestrates context collection using targeted queries, dependency traces,
   * and explainability tracks.
   */
  async retrieveContext(
    query: string,
    rawContextItems: ContextItem[],
    intent: string,
    activeCouplings: string[] = []
  ): Promise<RetrievalResult> {
    // Determine the active strategy based on intent
    let strategyUsed = 'Standard Heuristics';
    if (intent === 'refactor') {
      strategyUsed = 'Topological Couplings & Signature Layouts';
    } else if (intent === 'debug') {
      strategyUsed = 'Stack trace delta logs & recent commits';
    } else if (intent === 'architecture') {
      strategyUsed = 'Macro Narrative Spec maps';
    }

    // 1. Prioritize context items based on active strategy
    const prioritized = this.prioritizer.prioritize(rawContextItems, activeCouplings, intent);

    // 2. Generate explainability traces
    const tracePaths = prioritized.map((item) => item.path);
    const explanations = this.explainabilityEngine.explain(tracePaths, intent);

    if (this.eventBus) {
      this.eventBus.emit('retrieval.intent.classified', {
        intent,
        strategyUsed,
        itemCount: prioritized.length,
        queryLength: query.length,
      });
    }

    return {
      items: prioritized,
      intent,
      strategyUsed,
      explanations,
    };
  }
}
