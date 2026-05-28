import { ReasoningCache, type CacheKind } from './ReasoningCache.js';

export interface SemanticMemoryEntry<T = unknown> {
  id: string;
  kind: CacheKind | 'provider-optimization' | 'dependency-map';
  value: T;
  summary?: string;
  confidence: number;
  updatedAt: number;
}

export class PersistentSemanticMemory {
  private readonly entries = new Map<string, SemanticMemoryEntry>();

  constructor(private readonly cache = new ReasoningCache()) {}

  save<T>(id: string, entry: Omit<SemanticMemoryEntry<T>, 'id' | 'updatedAt'>): SemanticMemoryEntry<T> {
    const full: SemanticMemoryEntry<T> = { id, updatedAt: Date.now(), ...entry };
    this.entries.set(id, full);
    if (this.isCacheKind(entry.kind)) this.cache.set(id, full, entry.kind);
    return full;
  }

  get<T>(id: string, minConfidence = 0.7): SemanticMemoryEntry<T> | undefined {
    const local = this.entries.get(id) as SemanticMemoryEntry<T> | undefined;
    const cached = this.cache.get<SemanticMemoryEntry<T>>(id);
    const entry = local ?? cached;
    if (!entry || entry.confidence < minConfidence) return undefined;
    return entry;
  }

  search(kind: SemanticMemoryEntry['kind']): SemanticMemoryEntry[] {
    return Array.from(this.entries.values()).filter((entry) => entry.kind === kind).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private isCacheKind(kind: SemanticMemoryEntry['kind']): kind is CacheKind {
    return [
      'architecture-conclusion',
      'retrieval-result',
      'workflow-reasoning',
      'semantic-summary',
      'dependency-analysis',
      'orchestration-decision',
    ].includes(kind);
  }
}
