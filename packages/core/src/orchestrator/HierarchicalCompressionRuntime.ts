import type { ContextItem } from './ContextOptimizer.js';

export type ContextDetailLevel = 'raw' | 'function-summary' | 'module-summary' | 'domain-summary' | 'architecture-summary';

export interface CompressionResult {
  level: ContextDetailLevel;
  items: ContextItem[];
  summary: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
}

export class HierarchicalCompressionRuntime {
  compress(items: ContextItem[], targetTokens: number, preferredLevel?: ContextDetailLevel): CompressionResult {
    const originalTokens = this.estimate(items.map((item) => item.content).join('\n'));
    const level = preferredLevel ?? this.chooseLevel(originalTokens, targetTokens);
    const transformed = items.map((item) => ({ ...item, content: this.compressContent(item, level) }));
    const summary = transformed.map((item) => `[${item.path}]\n${item.content}`).join('\n\n');
    const compressedTokens = this.estimate(summary);
    return {
      level,
      items: transformed,
      summary,
      originalTokens,
      compressedTokens,
      tokensSaved: Math.max(0, originalTokens - compressedTokens),
    };
  }

  private chooseLevel(originalTokens: number, targetTokens: number): ContextDetailLevel {
    if (originalTokens <= targetTokens) return 'raw';
    if (originalTokens <= targetTokens * 1.8) return 'function-summary';
    if (originalTokens <= targetTokens * 3) return 'module-summary';
    if (originalTokens <= targetTokens * 6) return 'domain-summary';
    return 'architecture-summary';
  }

  private compressContent(item: ContextItem, level: ContextDetailLevel): string {
    if (level === 'raw') return item.content;
    const lines = item.content.split('\n').map((line) => line.trim()).filter(Boolean);
    const exports = lines.filter((line) => /\b(export|class|interface|function|type)\b/.test(line)).slice(0, 10);
    const deps = lines.filter((line) => /^import\b|depends?:|deps:/i.test(line)).slice(0, 8);

    if (level === 'function-summary') return [...exports, ...deps].join('\n') || this.firstSentences(item.content, 5);
    if (level === 'module-summary') return `module: ${item.path}\ncontracts: ${exports.join('; ') || 'implicit'}\ndeps: ${deps.join('; ') || 'not indexed'}`;
    if (level === 'domain-summary') return `domain item ${item.path}: importance ${item.importance}, relevance ${item.relevanceScore.toFixed(2)}`;
    return `architecture node ${item.path}: high-level role retained; raw implementation omitted`;
  }

  private firstSentences(content: string, count: number): string {
    return content.split(/[.\n]/).map((part) => part.trim()).filter(Boolean).slice(0, count).join('. ');
  }

  private estimate(content: string): number {
    return Math.ceil(content.length / 4);
  }
}
