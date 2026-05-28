/**
 * MetaCLI Brain — Repository Scaling Runtime
 *
 * Enterprise-scale indexing: lazy sub-graph loading, LRU in-memory cache,
 * and a priority queue so active files are indexed first. Background
 * workers hydrate the persistent graph without blocking the main thread.
 */

import type { EventBus } from '@metacli/core';
import type { MetaCLIEvents } from '@metacli/core';

export interface SubGraph {
  id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  indexedAt: number;
}

interface GraphNode { id: string; name: string; type: string; filePath: string }
interface GraphEdge { fromId: string; toId: string; relation: string }

interface LRUEntry<T> { value: T; accessedAt: number }

export interface ScalingConfig {
  maxCacheSizeNodes: number;
  backgroundBatchSize: number;
  priorityQueueMaxSize: number;
}

const DEFAULT_CONFIG: ScalingConfig = {
  maxCacheSizeNodes: 10_000,
  backgroundBatchSize: 50,
  priorityQueueMaxSize: 2_000,
};

export class RepositoryScalingRuntime {
  private readonly cache = new Map<string, LRUEntry<SubGraph>>();
  private readonly priorityQueue: string[] = [];
  private readonly config: ScalingConfig;
  private backgroundTimer: ReturnType<typeof setInterval> | null = null;
  private currentCacheNodeCount = 0;
  private loader: ((moduleId: string) => Promise<SubGraph>) | null = null;

  constructor(
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    config: Partial<ScalingConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public registerLoader(fn: (moduleId: string) => Promise<SubGraph>): void {
    this.loader = fn;
  }

  public startBackgroundWorkers(): void {
    if (this.backgroundTimer) return;

    this.backgroundTimer = setInterval(() => void this.processQueue(), 5_000);

    this.__eventBus?.emit('brain:scan_start' as any, { projectPath: process.cwd() });
  }

  public stopBackgroundWorkers(): void {
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
  }

  public async getSubGraph(moduleId: string): Promise<SubGraph> {
    const cached = this.cache.get(moduleId);
    if (cached) {
      cached.accessedAt = Date.now();
      return cached.value;
    }

    const graph = await this.loadSubGraph(moduleId);
    this.insertCache(moduleId, graph);
    return graph;
  }

  public prioritizeIndexing(filePaths: string[]): void {
    for (const path of filePaths) {
      if (!this.priorityQueue.includes(path)) {
        this.priorityQueue.unshift(path); // front of queue = highest priority
        if (this.priorityQueue.length > this.config.priorityQueueMaxSize) {
          this.priorityQueue.pop();
        }
      }
    }
  }

  public getCacheStats(): { cachedModules: number; totalNodes: number; queueDepth: number } {
    return {
      cachedModules: this.cache.size,
      totalNodes: this.currentCacheNodeCount,
      queueDepth: this.priorityQueue.length,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    const batch = this.priorityQueue.splice(0, this.config.backgroundBatchSize);
    if (batch.length === 0) return;

    for (const moduleId of batch) {
      if (!this.cache.has(moduleId)) {
        try {
          const graph = await this.loadSubGraph(moduleId);
          this.insertCache(moduleId, graph);

          await this.__eventBus?.emit('brain:scan_progress', {
            phase: 'indexing',
            progress: 0,
            detail: `Indexed ${moduleId}`,
          });
        } catch {
          // Non-fatal: skip unreadable modules
        }
      }
    }
  }

  private async loadSubGraph(moduleId: string): Promise<SubGraph> {
    if (this.loader) return this.loader(moduleId);
    // Stub: real implementation reads from SQLite AST store
    return { id: moduleId, nodes: [], edges: [], indexedAt: Date.now() };
  }

  private insertCache(moduleId: string, graph: SubGraph): void {
    const newNodes = graph.nodes.length;

    while (
      this.currentCacheNodeCount + newNodes > this.config.maxCacheSizeNodes &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    this.cache.set(moduleId, { value: graph, accessedAt: Date.now() });
    this.currentCacheNodeCount += newNodes;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const evicted = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.currentCacheNodeCount -= evicted?.value.nodes.length ?? 0;
    }
  }
}
