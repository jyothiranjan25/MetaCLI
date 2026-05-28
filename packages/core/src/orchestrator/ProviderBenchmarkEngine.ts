/**
 * MetaCLI Core — Provider Benchmarking Engine
 *
 * Automatically monitors, tracks, scores, and rates provider performance
 * (latencies, routingSpecializations, success rates, and token sizes)
 * to self-optimize orchestrator routing metrics.
 */

export interface PerformanceMetrics {
  providerId: string;
  latencyMs: number;
  success: boolean;
  reasoningScore?: number; // scale 1-10
}

export class ProviderBenchmarkEngine {
  private eventBus: any;
  private stats = new Map<string, PerformanceMetrics[]>();

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Records a response iteration.
   */
  trackResponse(metrics: PerformanceMetrics): void {
    if (!this.stats.has(metrics.providerId)) {
      this.stats.set(metrics.providerId, []);
    }
    
    const records = this.stats.get(metrics.providerId)!;
    records.push(metrics);

    // Keep last 50 entries
    if (records.length > 50) {
      records.shift();
    }

    if (this.eventBus) {
      this.eventBus.emit('provider.benchmarked', {
        providerId: metrics.providerId,
        latencyMs: metrics.latencyMs,
        success: metrics.success,
      });
    }
  }

  /**
   * Retrieves the preferred model target based on intent classification constraints.
   */
  getPreferredProvider(intent: string): string | undefined {
    // 1. Claude specialization for complex architectures and structural refactorings
    if (intent === 'architecture' || intent === 'refactor' || intent === 'security') {
      return 'claude-code';
    }
    
    // 2. Gemini specialization for lightning-fast inline implementations
    if (intent === 'optimize' || intent === 'debug') {
      return 'gemini-cli';
    }

    // 3. General fallbacks based on latency/success stats
    let bestProvider: string | undefined;
    let lowestLatency = Infinity;

    for (const [providerId, records] of this.stats.entries()) {
      const activeSuccess = records.filter(r => r.success).length;
      const total = records.length;
      
      // Filter out high failure rates (> 20%)
      if (total > 3 && activeSuccess / total < 0.8) {
        continue;
      }

      const avgLatency = records.reduce((acc, r) => acc + r.latencyMs, 0) / total;
      if (avgLatency < lowestLatency) {
        lowestLatency = avgLatency;
        bestProvider = providerId;
      }
    }

    return bestProvider;
  }
}
