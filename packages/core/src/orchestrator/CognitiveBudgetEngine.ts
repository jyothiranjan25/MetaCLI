export interface CognitiveBudget {
  maxRetrievalDepth: number;
  maxFileReads: number;
  maxOrchestrationLoops: number;
  maxProviderHandoffs: number;
  maxWorkflowRecursion: number;
  maxEstimatedTokens: number;
}

export interface CognitiveBudgetUsage {
  retrievalDepth: number;
  fileReads: number;
  orchestrationLoops: number;
  providerHandoffs: number;
  workflowRecursion: number;
  estimatedTokens: number;
}

export interface BudgetDecision {
  allowed: boolean;
  reason: string;
  remaining: CognitiveBudgetUsage;
}

const DEFAULT_BUDGET: CognitiveBudget = {
  maxRetrievalDepth: 2,
  maxFileReads: 8,
  maxOrchestrationLoops: 3,
  maxProviderHandoffs: 1,
  maxWorkflowRecursion: 2,
  maxEstimatedTokens: 12_000,
};

export class CognitiveBudgetEngine {
  private readonly budget: CognitiveBudget;
  private usage: CognitiveBudgetUsage = {
    retrievalDepth: 0,
    fileReads: 0,
    orchestrationLoops: 0,
    providerHandoffs: 0,
    workflowRecursion: 0,
    estimatedTokens: 0,
  };

  constructor(budget: Partial<CognitiveBudget> = {}) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
  }

  reserve(delta: Partial<CognitiveBudgetUsage>): BudgetDecision {
    const next = { ...this.usage };
    for (const [key, value] of Object.entries(delta) as Array<[keyof CognitiveBudgetUsage, number | undefined]>) {
      next[key] += value ?? 0;
    }

    const violation = this.findViolation(next);
    if (violation) {
      return { allowed: false, reason: violation, remaining: this.remaining() };
    }

    this.usage = next;
    return { allowed: true, reason: 'within-budget', remaining: this.remaining() };
  }

  canReserve(delta: Partial<CognitiveBudgetUsage>): BudgetDecision {
    const next = { ...this.usage };
    for (const [key, value] of Object.entries(delta) as Array<[keyof CognitiveBudgetUsage, number | undefined]>) {
      next[key] += value ?? 0;
    }
    const violation = this.findViolation(next);
    return { allowed: !violation, reason: violation ?? 'within-budget', remaining: this.remaining() };
  }

  getUsage(): CognitiveBudgetUsage {
    return { ...this.usage };
  }

  getBudget(): CognitiveBudget {
    return { ...this.budget };
  }

  remaining(): CognitiveBudgetUsage {
    return {
      retrievalDepth: Math.max(0, this.budget.maxRetrievalDepth - this.usage.retrievalDepth),
      fileReads: Math.max(0, this.budget.maxFileReads - this.usage.fileReads),
      orchestrationLoops: Math.max(0, this.budget.maxOrchestrationLoops - this.usage.orchestrationLoops),
      providerHandoffs: Math.max(0, this.budget.maxProviderHandoffs - this.usage.providerHandoffs),
      workflowRecursion: Math.max(0, this.budget.maxWorkflowRecursion - this.usage.workflowRecursion),
      estimatedTokens: Math.max(0, this.budget.maxEstimatedTokens - this.usage.estimatedTokens),
    };
  }

  reset(): void {
    this.usage = {
      retrievalDepth: 0,
      fileReads: 0,
      orchestrationLoops: 0,
      providerHandoffs: 0,
      workflowRecursion: 0,
      estimatedTokens: 0,
    };
  }

  private findViolation(next: CognitiveBudgetUsage): string | null {
    if (next.retrievalDepth > this.budget.maxRetrievalDepth) return 'retrieval-depth-budget-exceeded';
    if (next.fileReads > this.budget.maxFileReads) return 'file-read-budget-exceeded';
    if (next.orchestrationLoops > this.budget.maxOrchestrationLoops) return 'orchestration-loop-budget-exceeded';
    if (next.providerHandoffs > this.budget.maxProviderHandoffs) return 'provider-handoff-budget-exceeded';
    if (next.workflowRecursion > this.budget.maxWorkflowRecursion) return 'workflow-recursion-budget-exceeded';
    if (next.estimatedTokens > this.budget.maxEstimatedTokens) return 'token-budget-exceeded';
    return null;
  }
}
