import { ReasoningCache, type CacheKind } from './ReasoningCache.js';

export interface ReuseRecord<T = unknown> {
  key: string;
  kind: CacheKind;
  value: T;
  confidence: number;
  tokenEstimate: number;
  createdAt: number;
}

export interface ReuseLookup<T = unknown> {
  hit: boolean;
  record?: ReuseRecord<T>;
  tokensSaved: number;
}

export class SemanticReuseEngine {
  private readonly records = new Map<string, ReuseRecord>();

  constructor(private readonly cache = new ReasoningCache()) {}

  remember<T>(
    namespace: string,
    input: string,
    kind: CacheKind,
    value: T,
    confidence = 0.9,
  ): ReuseRecord<T> {
    const key = this.key(namespace, input);
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const record: ReuseRecord<T> = {
      key,
      kind,
      value,
      confidence,
      tokenEstimate: Math.ceil(serialized.length / 4),
      createdAt: Date.now(),
    };
    this.records.set(key, record);
    this.cache.set(key, record, kind);
    return record;
  }

  lookup<T>(namespace: string, input: string, minConfidence = 0.75): ReuseLookup<T> {
    const key = this.key(namespace, input);
    const cached = this.cache.get<ReuseRecord<T>>(key) ?? this.records.get(key) as ReuseRecord<T> | undefined;
    if (!cached || cached.confidence < minConfidence) {
      return { hit: false, tokensSaved: 0 };
    }
    return { hit: true, record: cached, tokensSaved: cached.tokenEstimate };
  }

  reuseOrCompute<T>(
    namespace: string,
    input: string,
    kind: CacheKind,
    compute: () => T,
    minConfidence = 0.75,
  ): T {
    const existing = this.lookup<T>(namespace, input, minConfidence);
    if (existing.hit && existing.record) return existing.record.value;
    return this.remember(namespace, input, kind, compute()).value;
  }

  getStats(): { records: number; tokenEstimate: number } {
    let tokenEstimate = 0;
    for (const record of this.records.values()) tokenEstimate += record.tokenEstimate;
    return { records: this.records.size, tokenEstimate };
  }

  private key(namespace: string, input: string): string {
    return `${namespace}:${ReasoningCache.hashKey(input.trim().toLowerCase())}`;
  }
}
