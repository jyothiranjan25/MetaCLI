/**
 * @metacli/brain — Memory Confidence Engine
 *
 * Implements aging confidence weights, stale memory decay triggers,
 * and hallucination reduction scoring on historical databases.
 */

export class MemoryConfidenceEngine {
  /**
   * Calculates confidence interval (0 to 1) for a memory record based on age.
   */
  evaluateConfidence(record: { timestamp?: string; importance?: number }): number {
    if (!record.timestamp) return 0.5;

    const timeDiffMs = Date.now() - new Date(record.timestamp).getTime();
    const daysOld = timeDiffMs / (1000 * 60 * 60 * 24);

    // Exponential decay curve: confidence decays over time, but slow down for high importance items
    const importanceOffset = (record.importance ?? 1) * 0.1;
    const decayRate = 0.05 / (1 + importanceOffset);
    const score = Math.exp(-daysOld * decayRate);

    return Math.max(0.1, Math.min(score, 1.0));
  }

  /**
   * Checks for extremely old database rows that have degraded confidence.
   */
  flagStaleRecords(records: Array<{ id: string; timestamp?: string; importance?: number }>): string[] {
    const staleIds: string[] = [];

    for (const rec of records) {
      if (this.evaluateConfidence(rec) < 0.3) {
        staleIds.push(rec.id);
      }
    }

    return staleIds;
  }
}
