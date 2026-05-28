import { ReasoningCache } from './ReasoningCache.js';
import type { ContextItem } from './ContextOptimizer.js';

export interface DeduplicatedContext {
  items: ContextItem[];
  references: Array<{ keptPath: string; duplicatePath: string; reason: string }>;
  tokensSaved: number;
}

export class ContextDeduplicator {
  dedupe(items: ContextItem[]): DeduplicatedContext {
    const seen = new Map<string, ContextItem>();
    const signatureOwners = new Map<string, ContextItem>();
    const kept: ContextItem[] = [];
    const references: DeduplicatedContext['references'] = [];
    let tokensSaved = 0;

    for (const item of items) {
      const exact = ReasoningCache.hashKey(this.normalizeText(item.content));
      const semantic = this.semanticSignature(item.content);
      const existing = seen.get(exact) ?? signatureOwners.get(semantic);

      if (existing) {
        references.push({ keptPath: existing.path, duplicatePath: item.path, reason: seen.has(exact) ? 'exact-content' : 'semantic-similarity' });
        tokensSaved += this.estimateTokens(item.content);
        continue;
      }

      seen.set(exact, item);
      signatureOwners.set(semantic, item);
      kept.push(item);
    }

    return { items: kept, references, tokensSaved };
  }

  private normalizeText(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private semanticSignature(content: string): string {
    const terms = this.normalizeText(content)
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 3 && !['import', 'export', 'from', 'const', 'class', 'function', 'interface'].includes(term))
      .slice(0, 40)
      .sort()
      .join(' ');
    return ReasoningCache.hashKey(terms);
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
}
