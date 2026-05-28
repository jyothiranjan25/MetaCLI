export type TokenWasteKind =
  | 'redundant-retrieval'
  | 'repeated-context'
  | 'low-value-file-read'
  | 'redundant-prompt'
  | 'orchestration-inefficiency'
  | 'provider-inefficiency';

export interface TokenWasteEvent {
  kind: TokenWasteKind;
  tokens: number;
  detail: string;
  timestamp?: number;
}

export interface TokenEfficiencyReport {
  totalTokens: number;
  wastedTokens: number;
  efficiencyScore: number;
  wasteByKind: Record<TokenWasteKind, number>;
  recommendations: string[];
}

const WASTE_KINDS: TokenWasteKind[] = [
  'redundant-retrieval',
  'repeated-context',
  'low-value-file-read',
  'redundant-prompt',
  'orchestration-inefficiency',
  'provider-inefficiency',
];

export class TokenEfficiencyAnalytics {
  private totalTokens = 0;
  private readonly wasteEvents: TokenWasteEvent[] = [];

  recordUsage(tokens: number): void {
    this.totalTokens += Math.max(0, tokens);
  }

  recordWaste(event: TokenWasteEvent): void {
    const normalized = { ...event, tokens: Math.max(0, event.tokens), timestamp: event.timestamp ?? Date.now() };
    this.wasteEvents.push(normalized);
    this.recordUsage(normalized.tokens);
  }

  detectRepeatedContext(contextHashes: string[], tokenEstimatePerRepeat: number): number {
    const seen = new Set<string>();
    let repeats = 0;
    for (const hash of contextHashes) {
      if (seen.has(hash)) repeats++;
      seen.add(hash);
    }
    if (repeats > 0) {
      this.recordWaste({
        kind: 'repeated-context',
        tokens: repeats * tokenEstimatePerRepeat,
        detail: `${repeats} repeated context block(s) detected`,
      });
    }
    return repeats;
  }

  report(): TokenEfficiencyReport {
    const wasteByKind = Object.fromEntries(WASTE_KINDS.map((kind) => [kind, 0])) as Record<TokenWasteKind, number>;
    let wastedTokens = 0;
    for (const event of this.wasteEvents) {
      wasteByKind[event.kind] += event.tokens;
      wastedTokens += event.tokens;
    }

    const usefulTokens = Math.max(0, this.totalTokens - wastedTokens);
    const efficiencyScore = this.totalTokens === 0 ? 1 : usefulTokens / this.totalTokens;
    return {
      totalTokens: this.totalTokens,
      wastedTokens,
      efficiencyScore,
      wasteByKind,
      recommendations: this.recommend(wasteByKind),
    };
  }

  reset(): void {
    this.totalTokens = 0;
    this.wasteEvents.length = 0;
  }

  private recommend(wasteByKind: Record<TokenWasteKind, number>): string[] {
    const recommendations: string[] = [];
    if (wasteByKind['redundant-retrieval'] > 0) recommendations.push('Increase semantic reuse threshold before graph traversal.');
    if (wasteByKind['repeated-context'] > 0) recommendations.push('Deduplicate compiled context blocks by stable hash.');
    if (wasteByKind['low-value-file-read'] > 0) recommendations.push('Prefer semantic summaries and symbol windows over full file reads.');
    if (wasteByKind['orchestration-inefficiency'] > 0) recommendations.push('Lower provider handoff and workflow loop budgets for similar tasks.');
    if (wasteByKind['provider-inefficiency'] > 0) recommendations.push('Route low-complexity work to lower-cost provider profiles.');
    return recommendations;
  }
}
