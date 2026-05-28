import { TokenEfficiencyAnalytics, type TokenEfficiencyReport, type TokenWasteKind } from './TokenEfficiencyAnalytics.js';

export interface TokenTelemetrySample {
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  usefulResponseScore?: number;
  redundancyRate?: number;
  retrievalWasteTokens?: number;
}

export interface ProviderTokenAnalytics {
  providerId: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  averageUsefulResponseScore: number;
  averageRedundancyRate: number;
}

export interface TokenTelemetryReport extends TokenEfficiencyReport {
  providers: ProviderTokenAnalytics[];
}

export class TokenTelemetryRuntime {
  private readonly efficiency = new TokenEfficiencyAnalytics();
  private readonly samples: TokenTelemetrySample[] = [];

  record(sample: TokenTelemetrySample): void {
    this.samples.push(sample);
    this.efficiency.recordUsage(sample.promptTokens + sample.completionTokens);
    if ((sample.retrievalWasteTokens ?? 0) > 0) {
      this.efficiency.recordWaste({
        kind: 'redundant-retrieval',
        tokens: sample.retrievalWasteTokens!,
        detail: `${sample.providerId} retrieval waste`,
      });
    }
    if ((sample.redundancyRate ?? 0) > 0.25) {
      this.recordWaste('repeated-context', Math.ceil(sample.promptTokens * (sample.redundancyRate ?? 0)), `${sample.providerId} high redundancy`);
    }
  }

  recordWaste(kind: TokenWasteKind, tokens: number, detail: string): void {
    this.efficiency.recordWaste({ kind, tokens, detail });
  }

  report(): TokenTelemetryReport {
    const grouped = new Map<string, TokenTelemetrySample[]>();
    for (const sample of this.samples) grouped.set(sample.providerId, [...(grouped.get(sample.providerId) ?? []), sample]);
    const providers = Array.from(grouped.entries()).map(([providerId, samples]) => ({
      providerId,
      calls: samples.length,
      promptTokens: samples.reduce((sum, sample) => sum + sample.promptTokens, 0),
      completionTokens: samples.reduce((sum, sample) => sum + sample.completionTokens, 0),
      averageUsefulResponseScore: samples.reduce((sum, sample) => sum + (sample.usefulResponseScore ?? 0.5), 0) / samples.length,
      averageRedundancyRate: samples.reduce((sum, sample) => sum + (sample.redundancyRate ?? 0), 0) / samples.length,
    }));
    return { ...this.efficiency.report(), providers };
  }
}
