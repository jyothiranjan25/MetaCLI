/**
 * @metacli/telemetry — Brain Telemetry & Observability Substrate
 *
 * Tracks, logs, monitors, and exposes codebase context indexing times,
 * retrieval precision ratios, semantic relevance scores, and cache hit ratios.
 */

export interface TelemetryMetrics {
  latencyMs: number;
  precision: number;
  cacheHit: boolean;
}

export class BrainTelemetry {
  private history: TelemetryMetrics[] = [];

  /**
   * Tracks a semantic retrieval event iteration.
   */
  recordRetrieval(metrics: TelemetryMetrics): void {
    this.history.push(metrics);
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Generates a performance observability metrics report.
   */
  getReport(): {
    averageLatencyMs: number;
    averagePrecision: number;
    cacheHitRatio: number;
    totalSearches: number;
  } {
    const total = this.history.length;
    if (total === 0) {
      return { averageLatencyMs: 0, averagePrecision: 1.0, cacheHitRatio: 0.0, totalSearches: 0 };
    }

    const sumLatency = this.history.reduce((acc, h) => acc + h.latencyMs, 0);
    const sumPrecision = this.history.reduce((acc, h) => acc + h.precision, 0);
    const hits = this.history.filter(h => h.cacheHit).length;

    return {
      averageLatencyMs: sumLatency / total,
      averagePrecision: sumPrecision / total,
      cacheHitRatio: hits / total,
      totalSearches: total,
    };
  }
}
