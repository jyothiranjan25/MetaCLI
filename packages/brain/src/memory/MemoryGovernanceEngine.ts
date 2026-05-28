/**
 * MetaCLI Brain — Memory Governance Engine
 *
 * Background governance loop: prunes low-confidence entries, collapses
 * near-duplicate memories by content fingerprint, and applies exponential
 * confidence decay to knowledge not accessed in recent sessions.
 * Runs asynchronously after session end — never blocks the reasoning loop.
 */

import type { EventBus } from '@metacli/core';
import type { MetaCLIEvents } from '@metacli/core';

export interface MemoryEntry {
  id: string;
  content: string;
  layer: 'hot' | 'warm' | 'cold';
  metadata?: string;
}

export interface GovernanceBrainStore {
  getAllMemories(): MemoryEntry[];
  deleteMemory(id: string): void;
  updateMemoryMetadata(id: string, metadata: string): void;
}

export interface GovernanceConfig {
  confidenceThreshold: number;  // prune below this (0–1)
  decayRate: number;            // per-day exponential decay rate (0–1)
  maxCycleIntervalMs: number;   // min ms between full cycles
}

export interface GovernanceStats {
  pruned: number;
  merged: number;
  recalibrated: number;
  durationMs: number;
}

const DEFAULT_CONFIG: GovernanceConfig = {
  confidenceThreshold: 0.1,
  decayRate: 0.05,
  maxCycleIntervalMs: 5 * 60 * 1000,
};

export class MemoryGovernanceEngine {
  private isRunning = false;
  private lastCycleAt = 0;
  private readonly config: GovernanceConfig;

  constructor(
    private readonly brainStore: GovernanceBrainStore,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    config: Partial<GovernanceConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.__eventBus) this.bindLifecycleEvents();
  }

  private bindLifecycleEvents(): void {
    this.__eventBus!.on('session:end', () => void this.runGovernanceCycle());
  }

  public async runGovernanceCycle(): Promise<GovernanceStats> {
    if (this.isRunning) return { pruned: 0, merged: 0, recalibrated: 0, durationMs: 0 };
    if (Date.now() - this.lastCycleAt < this.config.maxCycleIntervalMs) {
      return { pruned: 0, merged: 0, recalibrated: 0, durationMs: 0 };
    }

    this.isRunning = true;
    const start = Date.now();

    try {
      const pruned = this.pruneStaleMemories();
      const merged = this.mergeDuplicates();
      const recalibrated = this.applyConfidenceDecay();

      this.lastCycleAt = Date.now();

      const stats: GovernanceStats = { pruned, merged, recalibrated, durationMs: Date.now() - start };

      await this.__eventBus?.emit('brain:compaction', {
        tier: 'all',
        before: pruned + merged,
        after: 0,
      });

      return stats;
    } finally {
      this.isRunning = false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────

  private pruneStaleMemories(): number {
    let pruned = 0;
    for (const record of this.brainStore.getAllMemories()) {
      const meta = this.parseMeta(record.metadata);
      const conf = typeof meta.confidenceScore === 'number' ? meta.confidenceScore : 1.0;
      if (conf < this.config.confidenceThreshold) {
        this.brainStore.deleteMemory(record.id);
        pruned++;
      }
    }
    return pruned;
  }

  private mergeDuplicates(): number {
    const records = this.brainStore.getAllMemories();
    const seen = new Map<string, MemoryEntry>();
    let merged = 0;

    for (const record of records) {
      const key = this.fingerprint(record.content);
      const existing = seen.get(key);

      if (existing) {
        const existingConf = this.parseMeta(existing.metadata).confidenceScore ?? 0.5;
        const currentConf = this.parseMeta(record.metadata).confidenceScore ?? 0.5;

        // Keep higher-confidence entry, delete the other
        if (currentConf >= existingConf) {
          this.brainStore.deleteMemory(existing.id);
          seen.set(key, record);
        } else {
          this.brainStore.deleteMemory(record.id);
        }
        merged++;
      } else {
        seen.set(key, record);
      }
    }

    return merged;
  }

  private applyConfidenceDecay(): number {
    let recalibrated = 0;
    for (const record of this.brainStore.getAllMemories()) {
      const meta = this.parseMeta(record.metadata);
      const currentConf = typeof meta.confidenceScore === 'number' ? meta.confidenceScore : 1.0;
      const lastAccess = typeof meta.lastValidatedAt === 'number' ? meta.lastValidatedAt : Date.now();
      const ageDays = (Date.now() - lastAccess) / 86_400_000;

      // f(t) = confidence * (1 - decayRate)^ageDays
      const decayed = Math.max(0, Math.min(1, currentConf * Math.pow(1 - this.config.decayRate, ageDays)));

      if (Math.abs(decayed - currentConf) > 0.01) {
        this.brainStore.updateMemoryMetadata(record.id, JSON.stringify({ ...meta, confidenceScore: decayed }));
        recalibrated++;
      }
    }
    return recalibrated;
  }

  private parseMeta(raw?: string): Record<string, unknown> {
    if (!raw) return {};
    try { return JSON.parse(raw) as Record<string, unknown>; }
    catch { return {}; }
  }

  private fingerprint(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 128);
  }
}
