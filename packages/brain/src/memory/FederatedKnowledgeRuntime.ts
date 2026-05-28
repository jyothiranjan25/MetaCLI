/**
 * MetaCLI Brain — Federated Knowledge Runtime
 *
 * Cross-project memory federation backed by a per-project JSON store in
 * ~/.metacli/federated-knowledge/. Queries org-wide architectural patterns
 * filtered by intent, confidence, and namespace. Projects publish reusable
 * patterns to the shared store for downstream consumers.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '@metacli/core';
import type { MetaCLIEvents } from '@metacli/core';

export interface FederatedKnowledgeQuery {
  intent: string;
  targetProjects?: string[];
  maxResults: number;
  minConfidence?: number;
}

export interface FederatedKnowledgeEntry {
  id: string;
  projectId: string;
  content: string;
  patternType: 'architectural' | 'security' | 'performance' | 'testing' | 'api-design';
  confidence: number;
  publishedAt: number;
  tags: string[];
}

export interface FederatedQueryResult {
  entries: FederatedKnowledgeEntry[];
  sources: string[];
  durationMs: number;
}

export class FederatedKnowledgeRuntime {
  private readonly storeDir: string;
  private entryCache: FederatedKnowledgeEntry[] | null = null;

  constructor(
    private readonly localProjectId: string,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    storeDir?: string,
  ) {
    this.storeDir = storeDir ?? join(homedir(), '.metacli', 'federated-knowledge');
    this.ensureStoreDir();
  }

  public async queryFederatedMemory(query: FederatedKnowledgeQuery): Promise<FederatedQueryResult> {
    const start = Date.now();
    const minConf = query.minConfidence ?? 0.6;
    const intent = query.intent.toLowerCase();

    const all = this.loadAllEntries(query.targetProjects);

    const matches = all
      .filter(e => e.projectId !== this.localProjectId)
      .filter(e => e.confidence >= minConf)
      .filter(e =>
        e.content.toLowerCase().includes(intent) ||
        e.tags.some(tag => tag.toLowerCase().includes(intent)),
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, query.maxResults);

    const sources = [...new Set(matches.map(e => e.projectId))];
    const durationMs = Date.now() - start;

    await this.__eventBus?.emit('retrieval.completed', {
      query: query.intent,
      fileCount: matches.length,
      latencyMs: durationMs,
    });

    return { entries: matches, sources, durationMs };
  }

  public async publishPattern(
    patternId: string,
    content: string,
    patternType: FederatedKnowledgeEntry['patternType'],
    tags: string[] = [],
    confidence = 0.9,
  ): Promise<void> {
    const entry: FederatedKnowledgeEntry = {
      id: patternId,
      projectId: this.localProjectId,
      content,
      patternType,
      confidence,
      publishedAt: Date.now(),
      tags,
    };

    const entries = this.loadProjectEntries(this.localProjectId);
    const idx = entries.findIndex(e => e.id === patternId);
    if (idx >= 0) entries[idx] = entry; else entries.push(entry);

    this.saveProjectEntries(this.localProjectId, entries);
    this.entryCache = null;
  }

  public invalidateCache(): void {
    this.entryCache = null;
  }

  // ─── Private ─────────────────────────────────────────────────────

  private loadAllEntries(targetProjects?: string[]): FederatedKnowledgeEntry[] {
    if (this.entryCache) return this.entryCache;

    const entries: FederatedKnowledgeEntry[] = [];

    try {
      const files = readdirSync(this.storeDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const projectId = file.slice(0, -5);
        if (targetProjects && !targetProjects.includes(projectId)) continue;
        entries.push(...this.loadProjectEntries(projectId));
      }
    } catch {
      // Empty store is valid on first run
    }

    this.entryCache = entries;
    return entries;
  }

  private loadProjectEntries(projectId: string): FederatedKnowledgeEntry[] {
    const path = join(this.storeDir, `${projectId}.json`);
    if (!existsSync(path)) return [];
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as FederatedKnowledgeEntry[];
    } catch {
      return [];
    }
  }

  private saveProjectEntries(projectId: string, entries: FederatedKnowledgeEntry[]): void {
    writeFileSync(join(this.storeDir, `${projectId}.json`), JSON.stringify(entries, null, 2), 'utf-8');
  }

  private ensureStoreDir(): void {
    if (!existsSync(this.storeDir)) mkdirSync(this.storeDir, { recursive: true });
  }
}
