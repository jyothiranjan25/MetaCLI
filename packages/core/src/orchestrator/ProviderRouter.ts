/**
 * MetaCLI Core — Provider Router
 *
 * Selects the best available provider for each prompt based on:
 * - User preferences (explicit provider pinning)
 * - Health scores (exponential moving average)
 * - Rate limit status and cooldown timers
 * - Workflow role assignments
 * - Provider availability
 */

import type { AIAdapter } from './adapter-types.js';
import type { RoutingConfig } from '../config/schema.js';
import type { RoutingRequest, RoutingDecision } from '../events/types.js';
import { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export class ProviderRouter {
  private adapters = new Map<string, AIAdapter>();
  private healthScores = new Map<string, number>();
  private cooldowns = new Map<string, Date>();

  constructor(
    private config: RoutingConfig,
    private eventBus: EventBus<MetaCLIEvents>,
  ) {}

  /**
   * Register a provider adapter.
   */
  registerAdapter(adapter: AIAdapter): void {
    this.adapters.set(adapter.id, adapter);
    this.healthScores.set(adapter.id, 100); // Start with full health
  }

  /**
   * Remove a provider adapter.
   */
  unregisterAdapter(adapterId: string): void {
    this.adapters.delete(adapterId);
    this.healthScores.delete(adapterId);
    this.cooldowns.delete(adapterId);
  }

  /**
   * Select the best provider for the given request.
   */
  async selectProvider(request: RoutingRequest): Promise<RoutingDecision> {
    const candidates = await this.getAvailableCandidates(request);

    if (candidates.length === 0) {
      throw new AllProvidersExhaustedError(this.getShortestCooldown());
    }

    // Score and rank candidates
    const scored = candidates.map((adapter) => ({
      adapter,
      score: this.calculateScore(adapter.id, request),
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0];
    const alternatives = scored.slice(1).map((s) => ({
      adapterId: s.adapter.id,
      score: s.score,
    }));

    return {
      adapterId: selected.adapter.id,
      reason: this.explainSelection(selected.adapter.id, request),
      score: selected.score,
      alternatives,
    };
  }

  /**
   * Get a specific adapter by ID.
   */
  getAdapter(adapterId: string): AIAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Get all registered adapters.
   */
  getAllAdapters(): AIAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Record the outcome of a request for health scoring.
   */
  recordOutcome(adapterId: string, outcome: RequestOutcome): void {
    const currentScore = this.healthScores.get(adapterId) ?? 50;

    // Exponential moving average (alpha = 0.3)
    const alpha = 0.3;
    const newValue = outcome.success ? 100 : 0;
    const updatedScore = alpha * newValue + (1 - alpha) * currentScore;
    this.healthScores.set(adapterId, updatedScore);

    if (outcome.rateLimited) {
      const cooldownUntil =
        outcome.retryAfter ?? new Date(Date.now() + this.config.cooldownDuration);
      this.cooldowns.set(adapterId, cooldownUntil);

      this.eventBus.emit('provider:cooldown_start', {
        adapterId,
        until: cooldownUntil,
      });

      this.eventBus.emit('provider:rate_limited', {
        adapterId,
        retryAfter: cooldownUntil,
      });
    }

    if (updatedScore < this.config.healthScoreThreshold) {
      this.eventBus.emit('provider:unhealthy', {
        adapterId,
        reason: `Health score dropped to ${updatedScore.toFixed(1)}`,
      });
    } else {
      this.eventBus.emit('provider:healthy', {
        adapterId,
        score: updatedScore,
      });
    }
  }

  /**
   * Get health information for all providers.
   */
  getHealthSummary(): Map<string, ProviderHealth> {
    const summary = new Map<string, ProviderHealth>();

    for (const [id] of this.adapters) {
      summary.set(id, {
        score: this.healthScores.get(id) ?? 0,
        inCooldown: this.isInCooldown(id),
        cooldownUntil: this.cooldowns.get(id),
      });
    }

    return summary;
  }

  // ─── Private Methods ─────────────────────────────────────────

  private async getAvailableCandidates(request: RoutingRequest): Promise<AIAdapter[]> {
    const excludeSet = new Set(request.excludeProviders ?? []);
    const candidates: AIAdapter[] = [];

    for (const [id, adapter] of this.adapters) {
      // Skip explicitly excluded
      if (excludeSet.has(id)) continue;

      // Skip providers in cooldown
      if (this.isInCooldown(id)) continue;

      // Skip providers with critically low health
      const score = this.healthScores.get(id) ?? 0;
      if (score < this.config.healthScoreThreshold) continue;

      // Verify the provider is still available
      try {
        const health = await adapter.checkHealth();
        if (health.healthy) {
          candidates.push(adapter);
        }
      } catch {
        // Provider check failed — skip it
        this.healthScores.set(id, Math.max(0, (this.healthScores.get(id) ?? 50) - 10));
      }
    }

    return candidates;
  }

  private calculateScore(adapterId: string, request: RoutingRequest): number {
    let score = this.healthScores.get(adapterId) ?? 0;

    // Boost preferred provider
    if (request.preferredProvider === adapterId) {
      score += 50;
    }

    // Boost based on configured priority
    if (this.config.preferredProvider === adapterId) {
      score += 30;
    }

    // Boost based on fallback order position
    const fallbackIndex = this.config.fallbackOrder.indexOf(adapterId);
    if (fallbackIndex >= 0) {
      score += Math.max(0, 20 - fallbackIndex * 5);
    }

    return score;
  }

  private isInCooldown(adapterId: string): boolean {
    const cooldownUntil = this.cooldowns.get(adapterId);
    if (!cooldownUntil) return false;

    if (cooldownUntil <= new Date()) {
      // Cooldown expired — clean up
      this.cooldowns.delete(adapterId);
      this.eventBus.emit('provider:cooldown_end', { adapterId });
      return false;
    }

    return true;
  }

  private getShortestCooldown(): Date | undefined {
    let shortest: Date | undefined;

    for (const [, until] of this.cooldowns) {
      if (!shortest || until < shortest) {
        shortest = until;
      }
    }

    return shortest;
  }

  private explainSelection(adapterId: string, request: RoutingRequest): string {
    if (request.preferredProvider === adapterId) return 'User-preferred provider';
    if (this.config.preferredProvider === adapterId) return 'Configured default provider';
    return `Highest health score (${(this.healthScores.get(adapterId) ?? 0).toFixed(1)})`;
  }
}

// ─── Supporting Types ───────────────────────────────────────────

export interface RequestOutcome {
  success: boolean;
  rateLimited: boolean;
  retryAfter?: Date;
  durationMs: number;
  error?: string;
}

export interface ProviderHealth {
  score: number;
  inCooldown: boolean;
  cooldownUntil?: Date;
}

export class AllProvidersExhaustedError extends Error {
  constructor(public readonly nextAvailable?: Date) {
    const msg = nextAvailable
      ? `All providers exhausted. Next available at ${nextAvailable.toISOString()}`
      : 'All providers exhausted. No cooldown information available.';
    super(msg);
    this.name = 'AllProvidersExhaustedError';
  }
}
