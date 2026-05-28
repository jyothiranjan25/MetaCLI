/**
 * MetaCLI Core — Human Trust & Confidence Runtime
 *
 * Assesses total system execution stability scores, warning developers of
 * stale memory contexts or routing degradations.
 */

export interface TrustReport {
  score: number;
  isTrustworthy: boolean;
  warnings: string[];
}

export class TrustAndConfidenceRuntime {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Evaluates operational attributes to compute a trust coefficient index.
   */
  evaluateTrust(
    indexAgeMs: number,
    providerFailCount: number,
    staleMemoriesCount: number
  ): TrustReport {
    let score = 1.0;
    const warnings: string[] = [];

    if (indexAgeMs > 86400000) { // older than 1 day
      score -= 0.15;
      warnings.push('AST indexes are outdated. Reindex recommended.');
    }

    if (providerFailCount > 0) {
      score -= 0.2;
      warnings.push(`${providerFailCount} provider failures encountered recently.`);
    }

    if (staleMemoriesCount > 3) {
      score -= 0.1;
      warnings.push('Referencing multiple decayed cold memory segments.');
    }

    score = Math.max(0.1, Math.min(1.0, score));
    const isTrustworthy = score >= 0.7;

    const report = { score, isTrustworthy, warnings };

    if (this.eventBus) {
      this.eventBus.emit('trust.confidence.assessed', report);
    }

    return report;
  }
}
