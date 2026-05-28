import type { ContextItem } from './ContextOptimizer.js';

export interface RetrievalValueSignals {
  dependencyProximity?: number;
  recentEditScore?: number;
  architectureImportance?: number;
  workflowRelevance?: number;
  semanticDensity?: number;
  engineeringCriticality?: number;
}

export interface RankedContextItem extends ContextItem {
  valueScore: number;
  valueSignals: Required<RetrievalValueSignals>;
}

export class RetrievalValueRanker {
  rank(items: ContextItem[], signalByPath: Map<string, RetrievalValueSignals> = new Map()): RankedContextItem[] {
    return items
      .map((item) => {
        const signals = this.normalize(item, signalByPath.get(item.path));
        const valueScore =
          signals.dependencyProximity * 0.22 +
          signals.recentEditScore * 0.16 +
          signals.architectureImportance * 0.2 +
          signals.workflowRelevance * 0.16 +
          signals.semanticDensity * 0.14 +
          signals.engineeringCriticality * 0.12;

        return {
          ...item,
          relevanceScore: Math.max(item.relevanceScore, valueScore),
          valueScore,
          valueSignals: signals,
        };
      })
      .sort((a, b) => b.valueScore - a.valueScore);
  }

  private normalize(item: ContextItem, signals: RetrievalValueSignals = {}): Required<RetrievalValueSignals> {
    const semanticDensity = Math.min(1, this.countMeaningfulLines(item.content) / Math.max(1, Math.ceil(item.content.length / 300)));
    return {
      dependencyProximity: this.clamp(signals.dependencyProximity ?? item.relevanceScore),
      recentEditScore: this.clamp(signals.recentEditScore ?? 0.2),
      architectureImportance: this.clamp(signals.architectureImportance ?? item.importance / 10),
      workflowRelevance: this.clamp(signals.workflowRelevance ?? item.relevanceScore),
      semanticDensity: this.clamp(signals.semanticDensity ?? semanticDensity),
      engineeringCriticality: this.clamp(signals.engineeringCriticality ?? (item.importance > 7 ? 0.8 : 0.3)),
    };
  }

  private countMeaningfulLines(content: string): number {
    return content.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*');
    }).length;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
