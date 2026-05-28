/**
 * MetaCLI Core — Context Budget Intelligence Engine
 *
 * Manages provider token windows and slices context inputs (AST, memories, timeline)
 * dynamically based on importance weights, semantic density, and active budgets.
 */

import { TokenBudget, ContextItem } from './ContextOptimizer.js';

export interface AllocatedContext {
  items: ContextItem[];
  compressedSummary?: string;
  totalEstimatedTokens: number;
  tokensSaved: number;
}

export class ContextBudgetEngine {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Evaluates context item importances, counts tokens, and trims low-value blocks
   * to strictly fit within provider-allocated token budgets.
   */
  allocate(
    items: ContextItem[],
    budget: TokenBudget,
    providerId: string
  ): AllocatedContext {
    const maxTokens = budget.maxTokens ?? 4000;
    const reserveTokens = budget.reserveTokens ?? 1000;
    const targetLimit = maxTokens - reserveTokens;

    // Sort items by relevance first, then importance weight
    const sorted = [...items].sort((a, b) => {
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.05) {
        return b.relevanceScore - a.relevanceScore;
      }
      return (b.importance ?? 0) - (a.importance ?? 0);
    });

    const allocated: ContextItem[] = [];
    let currentTokens = 0;
    let tokensSaved = 0;

    for (const item of sorted) {
      // Approximate token sizes (4 characters per token estimate)
      const estimatedTokens = Math.ceil((item.content.length + item.path.length) / 4);

      if (currentTokens + estimatedTokens <= targetLimit) {
        allocated.push(item);
        currentTokens += estimatedTokens;
      } else {
        // Drop low-value blocks or compress if needed
        tokensSaved += estimatedTokens;
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('budget.allocated', {
        providerId,
        maxTokens,
        allocatedTokens: currentTokens,
        tokensSaved,
        itemsCount: allocated.length,
      });
    }

    return {
      items: allocated,
      totalEstimatedTokens: currentTokens,
      tokensSaved,
    };
  }
}
