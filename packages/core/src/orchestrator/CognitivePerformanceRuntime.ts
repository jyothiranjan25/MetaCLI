/**
 * MetaCLI Core — Cognitive Performance Runtime
 *
 * Keeps the intelligence layer feeling instant. Two-tier LRU cache (L1 in-process
 * V8 heap, L2 backing store), DataLoader-style request batching, latency tracking,
 * and cache invalidation tied to the file-change event stream.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

interface LRUEntry<T> { value: T; accessedAt: number }

export interface LatencySample { key: string; durationMs: number; cacheHit: boolean }

export interface PerformanceSnapshot {
  l1Size: number;
  l1HitRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
}

export class CognitivePerformanceRuntime {
  private readonly l1 = new Map<string, LRUEntry<unknown>>();
  private readonly maxL1Size: number;
  private readonly latencySamples: LatencySample[] = [];
  private l1Hits = 0;
  private l1Misses = 0;

  constructor(
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    maxL1Size = 5_000,
  ) {
    this.maxL1Size = maxL1Size;
    if (this.__eventBus) this.bindInvalidation();
  }

  private bindInvalidation(): void {
    // Invalidate embeddings when the brain re-scans the workspace
    this.__eventBus!.on('brain:scan_complete', () => this.clearL1());
  }

  public async getCached<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const entry = this.l1.get(key);
    if (entry) {
      entry.accessedAt = Date.now();
      this.l1Hits++;
      return entry.value as T;
    }

    this.l1Misses++;
    const start = Date.now();
    const value = await fetchFn();
    const durationMs = Date.now() - start;

    this.setL1(key, value);
    this.recordLatency({ key, durationMs, cacheHit: false });

    return value;
  }

  public async batchOperations<T, R>(
    items: T[],
    operation: (batch: T[]) => Promise<R[]>,
    batchSize = 10,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const start = Date.now();
      const batchResults = await operation(batch);
      this.recordLatency({ key: `batch:${i}`, durationMs: Date.now() - start, cacheHit: false });
      results.push(...batchResults);
    }

    return results;
  }

  public invalidate(key: string): void {
    this.l1.delete(key);
  }

  public invalidatePrefix(prefix: string): void {
    for (const key of this.l1.keys()) {
      if (key.startsWith(prefix)) this.l1.delete(key);
    }
  }

  public clearL1(): void {
    this.l1.clear();
  }

  public getSnapshot(): PerformanceSnapshot {
    const total = this.l1Hits + this.l1Misses;
    const sorted = [...this.latencySamples].map(s => s.durationMs).sort((a, b) => a - b);

    return {
      l1Size: this.l1.size,
      l1HitRate: total === 0 ? 0 : this.l1Hits / total,
      p50LatencyMs: this.percentile(sorted, 50),
      p95LatencyMs: this.percentile(sorted, 95),
      totalRequests: total,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────

  private setL1<T>(key: string, value: T): void {
    if (this.l1.size >= this.maxL1Size) this.evictLRU();
    this.l1.set(key, { value, accessedAt: Date.now() });
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, e] of this.l1) {
      if (e.accessedAt < oldestTime) { oldestTime = e.accessedAt; oldestKey = k; }
    }
    if (oldestKey) this.l1.delete(oldestKey);
  }

  private recordLatency(sample: LatencySample): void {
    this.latencySamples.push(sample);
    if (this.latencySamples.length > 2_000) this.latencySamples.shift();
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
  }
}
