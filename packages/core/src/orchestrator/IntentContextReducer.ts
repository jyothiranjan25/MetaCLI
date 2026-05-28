import type { ContextItem } from './ContextOptimizer.js';
import type { IntentType } from './IntentClassifier.js';

export interface ContextReductionPolicy {
  maxItems: number;
  preferPatterns: RegExp[];
  suppressPatterns: RegExp[];
  detailBias: 'local' | 'topology' | 'summary' | 'changes';
}

const POLICIES: Record<IntentType, ContextReductionPolicy> = {
  debug: { maxItems: 8, preferPatterns: [/test|spec|error|log|trace|runtime/i], suppressPatterns: [/readme|docs/i], detailBias: 'local' },
  refactor: { maxItems: 12, preferPatterns: [/interface|type|index|adapter|service/i], suppressPatterns: [/snapshot|fixture/i], detailBias: 'topology' },
  architecture: { maxItems: 10, preferPatterns: [/architecture|graph|orchestrator|runtime|index/i], suppressPatterns: [/test|spec/i], detailBias: 'summary' },
  migration: { maxItems: 10, preferPatterns: [/config|package|schema|adapter/i], suppressPatterns: [/snapshot/i], detailBias: 'changes' },
  optimize: { maxItems: 8, preferPatterns: [/cache|budget|performance|runtime|telemetry/i], suppressPatterns: [/docs|readme/i], detailBias: 'local' },
  test: { maxItems: 8, preferPatterns: [/test|spec|mock|fixture/i], suppressPatterns: [/dist|build/i], detailBias: 'local' },
  security: { maxItems: 10, preferPatterns: [/security|guard|auth|token|audit|env/i], suppressPatterns: [/docs/i], detailBias: 'topology' },
  document: { maxItems: 6, preferPatterns: [/summary|readme|architecture|index/i], suppressPatterns: [/test|spec|fixture/i], detailBias: 'summary' },
  general: { maxItems: 8, preferPatterns: [], suppressPatterns: [/dist|build|snapshot/i], detailBias: 'summary' },
};

export class IntentContextReducer {
  reduce(items: ContextItem[], intent: IntentType): { items: ContextItem[]; policy: ContextReductionPolicy; tokensSaved: number } {
    const policy = POLICIES[intent] ?? POLICIES.general;
    const scored = items
      .filter((item) => !policy.suppressPatterns.some((pattern) => pattern.test(item.path)))
      .map((item) => {
        const boost = policy.preferPatterns.some((pattern) => pattern.test(item.path)) ? 0.2 : 0;
        return { ...item, relevanceScore: Math.min(1, item.relevanceScore + boost) };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, policy.maxItems);
    const kept = new Set(scored.map((item) => item.path));
    const tokensSaved = items.filter((item) => !kept.has(item.path)).reduce((sum, item) => sum + Math.ceil(item.content.length / 4), 0);
    return { items: scored, policy, tokensSaved };
  }
}
