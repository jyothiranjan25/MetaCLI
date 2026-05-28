/**
 * MetaCLI Core — Zero-Exploration Runtime
 *
 * The central gatekeeper for all retrieval. Before touching raw files it
 * exhausts four cheaper tiers in order: reasoning cache → semantic reuse
 * → graph-directed retrieval → memory search. Raw file reads are the last
 * resort, never the first instinct.
 *
 * Every callsite routes through resolve() — which tier fires is logged
 * via EngineeringExplainabilityRuntime and metered by CognitiveBudgetEngine.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export type RetrievalTier = 'cache' | 'reuse' | 'graph' | 'memory' | 'raw-file';

export interface ZeroExplorationResult {
  content: string;
  tier: RetrievalTier;
  confidenceScore: number; // 0–1
  tokenEstimate: number;
  cached: boolean;
}

export interface TierProvider {
  name: RetrievalTier;
  canServe(intent: string, filePaths: string[]): Promise<boolean>;
  serve(intent: string, filePaths: string[]): Promise<ZeroExplorationResult | null>;
}

export interface ZeroExplorationConfig {
  minConfidenceToSkipRaw: number; // default 0.75 — above this, skip raw file reads
  maxRawReadsPerSession: number;
  emitTierEvents: boolean;
}

const DEFAULT_CONFIG: ZeroExplorationConfig = {
  minConfidenceToSkipRaw: 0.75,
  maxRawReadsPerSession: 50,
  emitTierEvents: true,
};

export class ZeroExplorationRuntime {
  private readonly tiers: TierProvider[] = [];
  private rawReadCount = 0;
  private readonly config: ZeroExplorationConfig;
  private readonly sessionStats = { cacheHits: 0, reuseHits: 0, graphHits: 0, memoryHits: 0, rawHits: 0 };

  constructor(
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    config: Partial<ZeroExplorationConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a tier provider. Tiers are consulted in registration order. */
  public registerTier(provider: TierProvider): void {
    this.tiers.push(provider);
  }

  /**
   * Resolve an intent against all registered tiers in cheapest-first order.
   * If all tiers return null, falls back to signalling a raw-file read is needed.
   */
  public async resolve(intent: string, filePaths: string[]): Promise<ZeroExplorationResult> {
    for (const tier of this.tiers) {
      try {
        const canServe = await tier.canServe(intent, filePaths);
        if (!canServe) continue;

        const result = await tier.serve(intent, filePaths);
        if (!result) continue;

        if (result.confidenceScore >= this.config.minConfidenceToSkipRaw || tier.name !== 'raw-file') {
          this.recordHit(tier.name);
          this.emitTierUsed(tier.name, result.confidenceScore);
          return result;
        }
      } catch {
        continue; // Non-fatal — try next tier
      }
    }

    // All tiers exhausted — signal raw read needed
    this.rawReadCount++;
    this.sessionStats.rawHits++;
    this.emitTierUsed('raw-file', 0);

    return {
      content: '',
      tier: 'raw-file',
      confidenceScore: 0,
      tokenEstimate: 0,
      cached: false,
    };
  }

  public getRawReadCount(): number {
    return this.rawReadCount;
  }

  public getSessionStats(): typeof this.sessionStats {
    return { ...this.sessionStats };
  }

  public resetSession(): void {
    this.rawReadCount = 0;
    Object.keys(this.sessionStats).forEach(k => {
      (this.sessionStats as Record<string, number>)[k] = 0;
    });
  }

  // ─── Private ─────────────────────────────────────────────────────

  private recordHit(tier: RetrievalTier): void {
    const key = `${tier.replace('-', '')}Hits` as keyof typeof this.sessionStats;
    if (key in this.sessionStats) (this.sessionStats as Record<string, number>)[key]++;
  }

  private emitTierUsed(tier: RetrievalTier, confidence: number): void {
    if (!this.config.emitTierEvents) return;
    this.__eventBus?.emit('retrieval.completed' as any, {
      query: `[ZeroExploration:${tier}]`,
      fileCount: 1,
      latencyMs: 0,
    });
    void confidence;
  }
}
