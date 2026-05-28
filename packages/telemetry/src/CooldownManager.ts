/**
 * MetaCLI Telemetry — Cooldown Manager
 *
 * Tracks provider cooldown periods after rate limits.
 * Manages cooldown timers and expiration notifications.
 */

import type { EventBus, MetaCLIEvents } from '@metacli/core';

export interface CooldownEntry {
  provider: string;
  startedAt: Date;
  expiresAt: Date;
  reason: string;
}

export class CooldownManager {
  private cooldowns = new Map<string, CooldownEntry>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private eventBus: EventBus<MetaCLIEvents>) {
    this.setupEventListeners();
  }

  /**
   * Set a cooldown for a provider.
   */
  setCooldown(provider: string, duration: number, reason: string): void {
    const expiresAt = new Date(Date.now() + duration);

    this.cooldowns.set(provider, {
      provider,
      startedAt: new Date(),
      expiresAt,
      reason,
    });

    // Clear any existing timer
    const existingTimer = this.timers.get(provider);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set expiration timer
    this.timers.set(
      provider,
      setTimeout(() => {
        this.cooldowns.delete(provider);
        this.timers.delete(provider);
        this.eventBus.emit('provider:cooldown_end', { adapterId: provider });
      }, duration),
    );

    this.eventBus.emit('provider:cooldown_start', {
      adapterId: provider,
      until: expiresAt,
    });
  }

  /**
   * Check if a provider is in cooldown.
   */
  isInCooldown(provider: string): boolean {
    const entry = this.cooldowns.get(provider);
    if (!entry) return false;

    if (entry.expiresAt <= new Date()) {
      this.cooldowns.delete(provider);
      return false;
    }

    return true;
  }

  /**
   * Get the cooldown entry for a provider.
   */
  getCooldown(provider: string): CooldownEntry | null {
    if (!this.isInCooldown(provider)) return null;
    return this.cooldowns.get(provider) ?? null;
  }

  /**
   * Get all active cooldowns.
   */
  getActiveCooldowns(): CooldownEntry[] {
    // Clean expired entries
    for (const [key, entry] of this.cooldowns) {
      if (entry.expiresAt <= new Date()) {
        this.cooldowns.delete(key);
      }
    }
    return Array.from(this.cooldowns.values());
  }

  /**
   * Get the shortest remaining cooldown across all providers.
   */
  getShortestCooldown(): CooldownEntry | null {
    const active = this.getActiveCooldowns();
    if (active.length === 0) return null;

    return active.reduce((shortest, entry) =>
      entry.expiresAt < shortest.expiresAt ? entry : shortest,
    );
  }

  /**
   * Clear cooldown for a specific provider.
   */
  clearCooldown(provider: string): void {
    this.cooldowns.delete(provider);
    const timer = this.timers.get(provider);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(provider);
    }
  }

  /**
   * Clean up all timers.
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cooldowns.clear();
  }

  // ─── Private ───────────────────────────────────────────────

  private setupEventListeners(): void {
    this.eventBus.on('provider:rate_limited', (data) => {
      const duration = data.retryAfter
        ? data.retryAfter.getTime() - Date.now()
        : 300_000; // 5 min default

      this.setCooldown(data.adapterId, Math.max(duration, 10_000), 'Rate limited');
    });
  }
}
