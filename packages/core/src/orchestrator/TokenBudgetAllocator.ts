import type { ContextItem, TokenBudget } from './ContextOptimizer.js';

export interface BudgetAllocation {
  selected: ContextItem[];
  dropped: ContextItem[];
  allocations: Array<{ path: string; allocatedTokens: number; reason: string }>;
  totalTokens: number;
  tokensSaved: number;
}

export class TokenBudgetAllocator {
  allocate(items: ContextItem[], budget: TokenBudget): BudgetAllocation {
    const usable = Math.max(0, budget.maxTokens - budget.reserveTokens);
    const sorted = [...items].sort((a, b) => {
      const aScore = a.relevanceScore * 0.65 + Math.min(1, a.importance / 10) * 0.35;
      const bScore = b.relevanceScore * 0.65 + Math.min(1, b.importance / 10) * 0.35;
      return bScore - aScore;
    });

    const selected: ContextItem[] = [];
    const dropped: ContextItem[] = [];
    const allocations: BudgetAllocation['allocations'] = [];
    let totalTokens = 0;
    let tokensSaved = 0;

    for (const item of sorted) {
      const cost = Math.ceil(item.content.length / 4);
      const highValue = item.relevanceScore >= 0.75 || item.importance >= 8;
      if (totalTokens + cost <= usable || (selected.length === 0 && highValue)) {
        selected.push(item);
        totalTokens += cost;
        allocations.push({ path: item.path, allocatedTokens: cost, reason: highValue ? 'high-value-context' : 'fits-budget' });
      } else {
        dropped.push(item);
        tokensSaved += cost;
      }
    }

    return { selected, dropped, allocations, totalTokens, tokensSaved };
  }
}
