/**
 * MetaCLI Core — Reasoning Cache
 *
 * Persistent session-scoped cache for architecture conclusions, retrieval
 * results, workflow reasoning, and semantic summaries. Keyed by a
 * content-stable hash of the input so identical queries never re-compute.
 * Invalidated automatically when the brain rescans the workspace.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export type CacheKind =
  | 'architecture-conclusion'
  | 'retrieval-result'
  | 'workflow-reasoning'
  | 'semantic-summary'
  | 'dependency-analysis'
  | 'orchestration-decision';

export interface CacheEntry<T = unknown> {
  key: string;
  kind: CacheKind;
  value: T;
  createdAt: number;
  hitCount: number;
  ttlMs: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

const KIND_TTL_MS: Record<CacheKind, number> = {
  'architecture-conclusion': 30 * 60_000,   // 30 min — stable
  'retrieval-result': 10 * 60_000,           // 10 min — changes with edits
  'workflow-reasoning': 20 * 60_000,         // 20 min
  'semantic-summary': 60 * 60_000,           // 1 hr — very stable
  'dependency-analysis': 15 * 60_000,        // 15 min
  'orchestration-decision': 5 * 60_000,      // 5 min — most volatile
};

export class ReasoningCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    maxSize = 2_000,
  ) {
    this.maxSize = maxSize;
    if (this.__eventBus) this.bindInvalidation();
  }

  public get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return undefined; }

    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    entry.hitCount++;
    this.hits++;
    return entry.value as T;
  }

  public set<T>(key: string, value: T, kind: CacheKind): void {
    if (this.store.size >= this.maxSize) this.evictLRU();

    this.store.set(key, {
      key,
      kind,
      value,
      createdAt: Date.now(),
      hitCount: 0,
      ttlMs: KIND_TTL_MS[kind],
    });
  }

  public getOrCompute<T>(key: string, kind: CacheKind, compute: () => T): T {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = compute();
    this.set(key, value, kind);
    return value;
  }

  public async getOrComputeAsync<T>(key: string, kind: CacheKind, compute: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value, kind);
    return value;
  }

  public invalidateByKind(kind: CacheKind): number {
    let removed = 0;
    for (const [k, entry] of this.store) {
      if (entry.kind === kind) { this.store.delete(k); removed++; }
    }
    return removed;
  }

  public invalidateAll(): void {
    this.store.clear();
  }

  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      evictions: this.evictions,
    };
  }

  /** Stable hash — same input always produces the same key. */
  public static hashKey(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // ─── Private ─────────────────────────────────────────────────────

  private bindInvalidation(): void {
    this.__eventBus!.on('brain:scan_complete', () => {
      // File changes invalidate volatile cache kinds
      this.invalidateByKind('retrieval-result');
      this.invalidateByKind('dependency-analysis');
    });
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, e] of this.store) {
      if (e.createdAt < oldestTime) { oldestTime = e.createdAt; oldestKey = k; }
    }
    if (oldestKey) { this.store.delete(oldestKey); this.evictions++; }
  }
}
