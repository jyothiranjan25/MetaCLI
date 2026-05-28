/**
 * MetaCLI Core — Engineering Confidence System
 *
 * Estimates operational confidence levels regarding memory fresh coefficients,
 * structural AST consistency, provider reliability, and refactoring safety bounds.
 */

export interface ConfidenceAssessment {
  score: number;
  factors: string[];
  recommendation: string;
}

export class EngineeringConfidenceEngine {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Assesses total system confidence index for current instruction proposals.
   */
  assessConfidence(
    retrievedCount: number,
    memoryAgesMs: number[],
    providerEmaScore: number
  ): ConfidenceAssessment {
    let score = 1.0;
    const factors: string[] = [];

    // 1. Evaluate retrieval breadth
    if (retrievedCount === 0) {
      score -= 0.3;
      factors.push('No relevant AST context symbols retrieved.');
    } else if (retrievedCount < 3) {
      score -= 0.1;
      factors.push('Narrow context scope retrieved.');
    }

    // 2. Evaluate memory freshness
    const staleMemoriesCount = memoryAgesMs.filter((age) => age > 86400000 * 7).length; // older than 7 days
    if (staleMemoriesCount > 0) {
      const decay = Math.min(0.2, staleMemoriesCount * 0.05);
      score -= decay;
      factors.push(`${staleMemoriesCount} stale memory partitions referenced.`);
    }

    // 3. Evaluate provider EMA scores
    if (providerEmaScore < 0.75) {
      score -= 0.15;
      factors.push('Provider health degrading below safe limits.');
    }

    score = Math.max(0.1, Math.min(1.0, score));

    let recommendation = 'High confidence: Codebase context and structural states stable.';
    if (score < 0.5) {
      recommendation = 'CAUTION: Stale context detected. Run re-scanning or verify proposals manually.';
    } else if (score < 0.8) {
      recommendation = 'Medium confidence: System states within acceptable operating margins.';
    }

    const assessment = { score, factors, recommendation };

    if (this.eventBus) {
      this.eventBus.emit('confidence.assessed' as any, assessment as any);
    }

    return assessment;
  }
}
