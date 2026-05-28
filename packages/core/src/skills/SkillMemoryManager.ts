/**
 * MetaCLI Core — Skill Memory Manager
 *
 * Per-skill namespaced memory: each skill writes to an isolated namespace so
 * skill-specific knowledge (Jira ticket context, GitHub PR patterns, etc.)
 * never pollutes the global engineering brain. Namespaces can be queried,
 * compacted, and cleared independently.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface SkillMemoryEntry {
  id: string;
  namespace: string;
  content: string;
  confidence: number;
  createdAt: number;
  accessCount: number;
  tags: string[];
}

export interface SkillMemoryQuery {
  namespace: string;
  keywords?: string[];
  minConfidence?: number;
  maxResults?: number;
}

export class SkillMemoryManager {
  private readonly store = new Map<string, SkillMemoryEntry[]>();

  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {}

  public write(namespace: string, content: string, tags: string[] = [], confidence = 0.9): string {
    const id = `${namespace}:${Date.now().toString(36)}`;
    const entry: SkillMemoryEntry = {
      id, namespace, content, confidence, tags,
      createdAt: Date.now(), accessCount: 0,
    };

    const entries = this.store.get(namespace) ?? [];
    entries.push(entry);
    this.store.set(namespace, entries);

    this.__eventBus?.emit('brain:memory_updated' as any, {
      tier: 'hot',
      entriesChanged: 1,
    });

    return id;
  }

  public query(q: SkillMemoryQuery): SkillMemoryEntry[] {
    const entries = this.store.get(q.namespace) ?? [];
    const minConf = q.minConfidence ?? 0;
    const keywords = q.keywords?.map(k => k.toLowerCase()) ?? [];

    return entries
      .filter(e => e.confidence >= minConf)
      .filter(e => keywords.length === 0 || keywords.some(k =>
        e.content.toLowerCase().includes(k) ||
        e.tags.some(t => t.toLowerCase().includes(k)),
      ))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, q.maxResults ?? 20)
      .map(e => { e.accessCount++; return e; });
  }

  public clearNamespace(namespace: string): number {
    const count = this.store.get(namespace)?.length ?? 0;
    this.store.delete(namespace);
    return count;
  }

  public getNamespaceStats(namespace: string): { count: number; avgConfidence: number } {
    const entries = this.store.get(namespace) ?? [];
    const avg = entries.length === 0 ? 0
      : entries.reduce((s, e) => s + e.confidence, 0) / entries.length;
    return { count: entries.length, avgConfidence: avg };
  }

  public getAllNamespaces(): string[] {
    return [...this.store.keys()];
  }
}
