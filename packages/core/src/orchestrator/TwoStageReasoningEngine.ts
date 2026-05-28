/**
 * MetaCLI Core — Two-Stage Reasoning Engine
 *
 * Stage 1 (cheap): semantic plan — classify intent, query graph and cache,
 *   determine if existing knowledge is sufficient to answer.
 * Stage 2 (expensive): deep reasoning — only fires if Stage 1 confidence
 *   falls below threshold or the task is classified as complex.
 *
 * Most tasks resolve in Stage 1 at a fraction of the token cost.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import { ReasoningCache } from './ReasoningCache.js';
import { MinimalReasoningMode, type TaskClassification } from './MinimalReasoningMode.js';

export interface Stage1Plan {
  classification: TaskClassification;
  cachedContext: string | null;
  requiresStage2: boolean;
  stage1ConfidenceScore: number;
  stage1TokensUsed: number;
}

export interface Stage2Result {
  content: string;
  tokensUsed: number;
  providerId: string;
}

export interface TwoStageResult {
  plan: Stage1Plan;
  finalContent: string;
  resolvedInStage: 1 | 2;
  totalTokensUsed: number;
}

export type Stage1Resolver = (intent: string, classification: TaskClassification) => Promise<{ content: string; confidence: number } | null>;
export type Stage2Resolver = (intent: string, plan: Stage1Plan) => Promise<Stage2Result>;

export class TwoStageReasoningEngine {
  private stage1Resolver: Stage1Resolver | null = null;
  private stage2Resolver: Stage2Resolver | null = null;
  private readonly STAGE2_THRESHOLD = 0.7;

  constructor(
    private readonly cache: ReasoningCache,
    private readonly mode: MinimalReasoningMode,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  public registerStage1Resolver(fn: Stage1Resolver): void {
    this.stage1Resolver = fn;
  }

  public registerStage2Resolver(fn: Stage2Resolver): void {
    this.stage2Resolver = fn;
  }

  public async reason(intent: string, affectedFiles: string[] = []): Promise<TwoStageResult> {
    const classification = this.mode.classify(intent, affectedFiles.length);
    const cacheKey = ReasoningCache.hashKey(`s1:${intent}:${classification.depth}`);

    // ── Stage 1: cheap semantic plan ─────────────────────────────
    const cachedContext = this.cache.get<string>(cacheKey) ?? null;
    let stage1Confidence = cachedContext ? 0.95 : 0;
    let stage1Tokens = cachedContext ? 0 : 50;

    if (!cachedContext && this.stage1Resolver) {
      const result = await this.stage1Resolver(intent, classification);
      if (result) {
        stage1Confidence = result.confidence;
        stage1Tokens = Math.ceil(result.content.length / 4);
        if (result.confidence >= this.STAGE2_THRESHOLD) {
          this.cache.set(cacheKey, result.content, 'workflow-reasoning');
        }
      }
    }

    const requiresStage2 =
      classification.depth === 'complex' ||
      stage1Confidence < this.STAGE2_THRESHOLD;

    const plan: Stage1Plan = {
      classification,
      cachedContext,
      requiresStage2,
      stage1ConfidenceScore: stage1Confidence,
      stage1TokensUsed: stage1Tokens,
    };

    // ── Resolve in Stage 1 if confidence is high enough ──────────
    if (!requiresStage2) {
      const content = cachedContext ?? `[Stage 1 resolved at confidence ${stage1Confidence.toFixed(2)}]`;
      return { plan, finalContent: content, resolvedInStage: 1, totalTokensUsed: stage1Tokens };
    }

    // ── Stage 2: deep reasoning ───────────────────────────────────
    if (!this.stage2Resolver) {
      return { plan, finalContent: cachedContext ?? '', resolvedInStage: 1, totalTokensUsed: stage1Tokens };
    }

    const s2 = await this.stage2Resolver(intent, plan);

    this.__eventBus?.emit('provider.benchmarked' as any, {
      providerId: s2.providerId,
      latencyMs: 0,
      success: true,
    });

    return {
      plan,
      finalContent: s2.content,
      resolvedInStage: 2,
      totalTokensUsed: stage1Tokens + s2.tokensUsed,
    };
  }
}
