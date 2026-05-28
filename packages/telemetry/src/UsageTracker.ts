/**
 * MetaCLI Telemetry — Usage Tracker
 *
 * Tracks per-provider usage: request counts, token usage, costs,
 * success/failure rates, and timing. Persists to an in-memory store
 * (SQLite in Phase 2+).
 */

import type { EventBus, MetaCLIEvents } from '@metacli/core';

export interface UsageRecord {
  provider: string;
  timestamp: Date;
  success: boolean;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  rateLimited: boolean;
  error?: string;
}

export interface ProviderUsageSummary {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  avgDurationMs: number;
  successRate: number;
  lastUsed?: Date;
}

export class UsageTracker {
  private records: UsageRecord[] = [];
  private maxRecords = 10_000;

  constructor(private eventBus: EventBus<MetaCLIEvents>) {
    this.setupEventListeners();
  }

  /**
   * Manually record a usage event.
   */
  record(entry: UsageRecord): void {
    this.records.push(entry);

    // Trim old records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * Get usage summary for a specific provider.
   */
  getProviderSummary(provider: string): ProviderUsageSummary {
    const providerRecords = this.records.filter((r) => r.provider === provider);
    return this.computeSummary(provider, providerRecords);
  }

  /**
   * Get usage summary for all providers.
   */
  getAllSummaries(): ProviderUsageSummary[] {
    const providers = new Set(this.records.map((r) => r.provider));
    return Array.from(providers).map((p) => this.getProviderSummary(p));
  }

  /**
   * Get usage records within a time window.
   */
  getRecordsSince(since: Date): UsageRecord[] {
    return this.records.filter((r) => r.timestamp >= since);
  }

  /**
   * Get total estimated cost across all providers.
   */
  getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  }

  // ─── Private ───────────────────────────────────────────────

  private computeSummary(provider: string, records: UsageRecord[]): ProviderUsageSummary {
    const total = records.length;
    const successful = records.filter((r) => r.success).length;
    const failed = records.filter((r) => !r.success).length;
    const rateLimitHits = records.filter((r) => r.rateLimited).length;
    const totalInput = records.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
    const totalOutput = records.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);
    const totalCost = records.reduce((sum, r) => sum + (r.cost ?? 0), 0);
    const avgDuration =
      total > 0 ? records.reduce((sum, r) => sum + r.durationMs, 0) / total : 0;

    return {
      provider,
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      rateLimitHits,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      estimatedCost: totalCost,
      avgDurationMs: Math.round(avgDuration),
      successRate: total > 0 ? successful / total : 0,
      lastUsed: records.length > 0 ? records[records.length - 1].timestamp : undefined,
    };
  }

  private setupEventListeners(): void {
    this.eventBus.on('prompt:complete', (data) => {
      this.record({
        provider: data.provider,
        timestamp: new Date(),
        success: true,
        durationMs: 0, // Would need timing from orchestrator
        inputTokens: data.usage?.inputTokens,
        outputTokens: data.usage?.outputTokens,
        cost: data.usage?.cost,
        rateLimited: false,
      });
    });

    this.eventBus.on('provider:rate_limited', (data) => {
      this.record({
        provider: data.adapterId,
        timestamp: new Date(),
        success: false,
        durationMs: 0,
        rateLimited: true,
      });
    });

    this.eventBus.on('prompt:error', (data) => {
      this.record({
        provider: data.provider,
        timestamp: new Date(),
        success: false,
        durationMs: 0,
        rateLimited: false,
        error: data.error,
      });
    });
  }
}
