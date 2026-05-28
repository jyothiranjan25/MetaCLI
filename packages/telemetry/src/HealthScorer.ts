/**
 * MetaCLI Telemetry — Health Scorer
 *
 * Maintains per-provider health scores using exponential moving average.
 * Scores decay on failures and recover on successes.
 */

import type { EventBus, MetaCLIEvents } from '@metacli/core';

export interface HealthScore {
  provider: string;
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  recentSuccesses: number;
  recentFailures: number;
  lastUpdated: Date;
}

export class HealthScorer {
  private scores = new Map<string, HealthScore>();
  private alpha = 0.3; // EMA smoothing factor
  private windowSize = 10; // Recent events for trend calculation
  private recentOutcomes = new Map<string, boolean[]>();

  constructor(private eventBus: EventBus<MetaCLIEvents>) {
    this.setupEventListeners();
  }

  /**
   * Get the health score for a provider.
   */
  getScore(provider: string): HealthScore {
    return (
      this.scores.get(provider) ?? {
        provider,
        score: 100,
        trend: 'stable' as const,
        recentSuccesses: 0,
        recentFailures: 0,
        lastUpdated: new Date(),
      }
    );
  }

  /**
   * Get all health scores.
   */
  getAllScores(): HealthScore[] {
    return Array.from(this.scores.values());
  }

  /**
   * Record a success for a provider.
   */
  recordSuccess(provider: string): void {
    this.updateScore(provider, true);
  }

  /**
   * Record a failure for a provider.
   */
  recordFailure(provider: string): void {
    this.updateScore(provider, false);
  }

  // ─── Private ───────────────────────────────────────────────

  private updateScore(provider: string, success: boolean): void {
    const current = this.getScore(provider);
    const newValue = success ? 100 : 0;

    // Exponential moving average
    const updatedScore = this.alpha * newValue + (1 - this.alpha) * current.score;

    // Track recent outcomes for trend analysis
    const outcomes = this.recentOutcomes.get(provider) ?? [];
    outcomes.push(success);
    if (outcomes.length > this.windowSize) {
      outcomes.shift();
    }
    this.recentOutcomes.set(provider, outcomes);

    // Calculate trend
    const recentSuccesses = outcomes.filter(Boolean).length;
    const recentFailures = outcomes.filter((o) => !o).length;
    const successRate = outcomes.length > 0 ? recentSuccesses / outcomes.length : 0.5;

    let trend: 'improving' | 'stable' | 'declining';
    if (successRate > 0.7) trend = 'improving';
    else if (successRate < 0.3) trend = 'declining';
    else trend = 'stable';

    this.scores.set(provider, {
      provider,
      score: Math.max(0, Math.min(100, updatedScore)),
      trend,
      recentSuccesses,
      recentFailures,
      lastUpdated: new Date(),
    });
  }

  private setupEventListeners(): void {
    this.eventBus.on('prompt:complete', (data) => {
      this.recordSuccess(data.provider);
    });

    this.eventBus.on('prompt:error', (data) => {
      this.recordFailure(data.provider);
    });

    this.eventBus.on('provider:rate_limited', (data) => {
      this.recordFailure(data.adapterId);
    });

    this.eventBus.on('provider:healthy', (data) => {
      // Merge external health signals
      const current = this.getScore(data.adapterId);
      if (current) {
        this.scores.set(data.adapterId, {
          ...current,
          lastUpdated: new Date(),
        });
      }
    });
  }
}
