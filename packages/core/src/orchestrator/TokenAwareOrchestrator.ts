import { CognitiveBudgetEngine } from './CognitiveBudgetEngine.js';

export interface OrchestrationCandidate {
  id: string;
  providerId?: string;
  retrievalCost: number;
  reasoningCost: number;
  providerCost: number;
  redundancyPenalty?: number;
  confidence: number;
}

export interface TokenAwareDecision {
  selected: OrchestrationCandidate | null;
  score: number;
  reason: string;
  rejected: Array<{ id: string; reason: string }>;
}

export class TokenAwareOrchestrator {
  constructor(private readonly budget = new CognitiveBudgetEngine()) {}

  choose(candidates: OrchestrationCandidate[]): TokenAwareDecision {
    const rejected: TokenAwareDecision['rejected'] = [];
    let selected: OrchestrationCandidate | null = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const estimatedTokens = candidate.retrievalCost + candidate.reasoningCost + candidate.providerCost;
      const budgetDecision = this.budget.canReserve({ estimatedTokens, orchestrationLoops: 1 });
      if (!budgetDecision.allowed) {
        rejected.push({ id: candidate.id, reason: budgetDecision.reason });
        continue;
      }

      const waste = estimatedTokens + (candidate.redundancyPenalty ?? 0);
      const score = candidate.confidence * 10_000 - waste;
      if (score > bestScore) {
        selected = candidate;
        bestScore = score;
      }
    }

    if (!selected) {
      return { selected: null, score: 0, reason: 'no-candidate-within-budget', rejected };
    }

    this.budget.reserve({
      estimatedTokens: selected.retrievalCost + selected.reasoningCost + selected.providerCost,
      orchestrationLoops: 1,
    });

    return {
      selected,
      score: bestScore,
      reason: `selected ${selected.id} for confidence ${selected.confidence.toFixed(2)} at lowest effective token cost`,
      rejected,
    };
  }

  getBudgetEngine(): CognitiveBudgetEngine {
    return this.budget;
  }
}
