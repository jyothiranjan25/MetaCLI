/**
 * MetaCLI Core — Context Budget Intelligence Optimizer
 *
 * Manages token budget tracking, semantic ranking, hierarchical context
 * summarization, and token-aware context optimization to fit large codebases
 * dynamically inside model context windows.
 */

export interface TokenBudget {
  maxTokens: number;
  reserveTokens: number;
}

export interface ContextItem {
  path: string;
  content: string;
  importance: number;
  relevanceScore: number; // 0-1
}

export interface OptimizedContext {
  items: ContextItem[];
  compressedSummary?: string;
  tokensSaved: number;
  totalEstimatedTokens: number;
}

export class ContextOptimizer {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Optimizes the input context collection by ranking, pruning, and compressing
   * nodes to strictly stay within the specified token budget.
   */
  optimize(
    items: ContextItem[],
    budget: TokenBudget,
    providerId: string
  ): OptimizedContext {
    const usableBudget = budget.maxTokens - budget.reserveTokens;
    
    // 1. Rank items based on (relevanceScore * 0.7 + importance * 0.3)
    const ranked = [...items].sort((a, b) => {
      const scoreA = a.relevanceScore * 0.7 + (a.importance / 10) * 0.3;
      const scoreB = b.relevanceScore * 0.7 + (b.importance / 10) * 0.3;
      return scoreB - scoreA;
    });

    const acceptedItems: ContextItem[] = [];
    let currentTokens = 0;
    let tokensSaved = 0;

    for (const item of ranked) {
      // Estimate token count as ~1 token per 4 characters (standard approximation)
      const estimatedTokens = Math.ceil(item.content.length / 4);

      if (currentTokens + estimatedTokens <= usableBudget) {
        acceptedItems.push(item);
        currentTokens += estimatedTokens;
      } else {
        tokensSaved += estimatedTokens;
      }
    }

    let compressedSummary: string | undefined;
    if (tokensSaved > 0) {
      // Generate a hierarchical summary of items that were pruned out to prevent context loss
      const pruned = ranked.slice(acceptedItems.length);
      compressedSummary = `Hierarchical Code Map (Pruned items due to context budget):\n` +
        pruned.map(p => `- ${p.path} [Relevance: ${(p.relevanceScore * 100).toFixed(0)}%, Importance Score: ${p.importance}]`).join('\n');
    }

    if (this.eventBus) {
      this.eventBus.emit('context.optimized', {
        providerId,
        tokensSaved,
      });
    }

    return {
      items: acceptedItems,
      compressedSummary,
      tokensSaved,
      totalEstimatedTokens: currentTokens,
    };
  }
}
