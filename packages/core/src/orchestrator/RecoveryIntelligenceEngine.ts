/**
 * MetaCLI Core — Recovery Intelligence Engine
 *
 * Self-healing runtime wrapper: classifies failures, applies typed
 * recovery strategies (retry, halve-context, fallback-provider, skip),
 * and resumes execution from the last valid checkpoint.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface ExecutionCheckpoint {
  workflowId: string;
  stepId: string;
  state: unknown;
  timestamp: number;
  attemptCount: number;
}

export type RecoveryStrategy = 'retry' | 'halve-context' | 'fallback-provider' | 'skip' | 'abort';

export interface RecoveryDecision {
  strategy: RecoveryStrategy;
  reason: string;
  retryDelayMs?: number;
}

export interface RecoveryResult<T> {
  value: T;
  recovered: boolean;
  strategy?: RecoveryStrategy;
  attemptCount: number;
}

export class RecoveryIntelligenceEngine {
  private readonly checkpoints = new Map<string, ExecutionCheckpoint>();
  private readonly MAX_ATTEMPTS = 4;

  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {}

  public saveCheckpoint(checkpoint: Omit<ExecutionCheckpoint, 'attemptCount'>): void {
    const existing = this.checkpoints.get(checkpoint.workflowId);
    this.checkpoints.set(checkpoint.workflowId, {
      ...checkpoint,
      attemptCount: existing?.attemptCount ?? 0,
    });
  }

  public async executeWithRecovery<T>(
    workflowId: string,
    operation: () => Promise<T>,
    onRecovery?: (decision: RecoveryDecision, checkpoint: ExecutionCheckpoint) => Promise<T>,
  ): Promise<RecoveryResult<T>> {
    const checkpoint = this.checkpoints.get(workflowId);
    let attempts = checkpoint?.attemptCount ?? 0;

    try {
      const value = await operation();
      this.resetAttempts(workflowId);
      return { value, recovered: false, attemptCount: attempts };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      attempts++;
      this.bumpAttempts(workflowId, attempts);

      const decision = this.classify(error, attempts);

      await this.__eventBus?.emit('system:error', {
        error: `[Recovery] ${workflowId} — strategy: ${decision.strategy} — ${error.message}`,
        fatal: false,
      });

      if (decision.strategy === 'abort' || !onRecovery || !this.checkpoints.get(workflowId)) {
        throw error;
      }

      if (decision.retryDelayMs) await this.sleep(decision.retryDelayMs);

      const value = await onRecovery(decision, this.checkpoints.get(workflowId)!);
      return { value, recovered: true, strategy: decision.strategy, attemptCount: attempts };
    }
  }

  public clearCheckpoints(workflowId: string): void {
    this.checkpoints.delete(workflowId);
  }

  public getCheckpoint(workflowId: string): ExecutionCheckpoint | undefined {
    return this.checkpoints.get(workflowId);
  }

  // ─── Private ─────────────────────────────────────────────────────

  private classify(error: Error, attempts: number): RecoveryDecision {
    if (attempts >= this.MAX_ATTEMPTS) {
      return { strategy: 'abort', reason: 'Max recovery attempts reached' };
    }

    const msg = error.message.toLowerCase();

    if (msg.includes('rate limit') || msg.includes('429')) {
      return { strategy: 'fallback-provider', reason: 'Provider rate-limited', retryDelayMs: 2000 };
    }
    if (msg.includes('token limit') || msg.includes('context length') || msg.includes('too long')) {
      return { strategy: 'halve-context', reason: 'Context window exceeded — reducing depth' };
    }
    if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('connection')) {
      return { strategy: 'retry', reason: 'Transient network failure', retryDelayMs: 500 * (2 ** (attempts - 1)) };
    }
    if (msg.includes('not found') || msg.includes('404')) {
      return { strategy: 'skip', reason: 'Resource not found — skipping step' };
    }

    return { strategy: 'retry', reason: 'Unknown transient error', retryDelayMs: 500 };
  }

  private resetAttempts(workflowId: string): void {
    const cp = this.checkpoints.get(workflowId);
    if (cp) cp.attemptCount = 0;
  }

  private bumpAttempts(workflowId: string, count: number): void {
    const cp = this.checkpoints.get(workflowId);
    if (cp) {
      cp.attemptCount = count;
    } else {
      this.checkpoints.set(workflowId, {
        workflowId, stepId: 'unknown', state: null, timestamp: Date.now(), attemptCount: count,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
