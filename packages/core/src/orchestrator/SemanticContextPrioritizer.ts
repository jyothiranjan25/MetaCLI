/**
 * MetaCLI Core — Semantic Context Prioritizer Engine
 *
 * Ranks context items using codebase dependency matrices, active workspace
 * couplings, import structures, and architectural priority weights.
 */

import { ContextItem } from './ContextOptimizer.js';

export class SemanticContextPrioritizer {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Sorts and refines context priorities based on structural importance,
   * matching imports coupling, and intent weights.
   */
  prioritize(
    items: ContextItem[],
    activeCouplings: string[],
    intent: string
  ): ContextItem[] {
    const prioritized = items.map((item) => {
      let boost = 0.0;

      // 1. Boost based on architectural coupling relations
      const hasCoupling = activeCouplings.some(
        (coupledPath) => item.path.includes(coupledPath) || coupledPath.includes(item.path)
      );
      if (hasCoupling) {
        boost += 0.25;
      }

      // 2. Intent-specific weights
      if (intent === 'refactor' && (item.path.includes('index') || item.path.includes('interface'))) {
        boost += 0.15;
      } else if (intent === 'debug' && (item.path.includes('test') || item.path.includes('spec') || item.path.includes('error'))) {
        boost += 0.2;
      }

      // 3. High importance boosting
      if (item.importance && item.importance > 0.8) {
        boost += 0.1;
      }

      return {
        ...item,
        relevanceScore: Math.min(1.0, item.relevanceScore + boost),
      };
    });

    if (this.eventBus) {
      this.eventBus.emit('prioritizer.completed', {
        itemCount: items.length,
        intent,
      });
    }

    return prioritized.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
