export interface ExpirableContext {
  id: string;
  kind: 'summary' | 'retrieval' | 'architecture-map' | 'workflow' | 'provider-optimization';
  updatedAt: number;
  confidence: number;
  accessCount?: number;
}

export interface ExpirationDecision {
  id: string;
  expired: boolean;
  newConfidence: number;
  reason: string;
}

const HALF_LIFE_MS: Record<ExpirableContext['kind'], number> = {
  summary: 60 * 60_000,
  retrieval: 15 * 60_000,
  'architecture-map': 4 * 60 * 60_000,
  workflow: 45 * 60_000,
  'provider-optimization': 24 * 60 * 60_000,
};

export class ContextExpirationEngine {
  evaluate(contexts: ExpirableContext[], now = Date.now(), minConfidence = 0.45): ExpirationDecision[] {
    return contexts.map((context) => {
      const age = Math.max(0, now - context.updatedAt);
      const halfLives = age / HALF_LIFE_MS[context.kind];
      const accessBoost = Math.min(0.15, (context.accessCount ?? 0) * 0.02);
      const newConfidence = Math.max(0, context.confidence * Math.pow(0.5, halfLives) + accessBoost);
      return {
        id: context.id,
        expired: newConfidence < minConfidence,
        newConfidence,
        reason: newConfidence < minConfidence ? 'stale-low-confidence-context' : 'context-still-useful',
      };
    });
  }
}
