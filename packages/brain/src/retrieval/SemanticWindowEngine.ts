import type { BrainStore, DependencyRecord, SymbolRecord } from '../persistence/BrainStore.js';

export interface SemanticWindowRequest {
  filePath: string;
  symbolName?: string;
  intent?: string;
  radiusLines?: number;
  includeDependencies?: boolean;
}

export interface SemanticWindow {
  filePath: string;
  symbols: SymbolRecord[];
  dependencies: DependencyRecord[];
  startLine: number;
  endLine: number;
  summary: string;
  source?: string;
  tokenEstimate: number;
}

export type SourceReader = (filePath: string, startLine: number, endLine: number) => Promise<string> | string;

export class SemanticWindowEngine {
  constructor(
    private readonly store: BrainStore,
    private readonly sourceReader?: SourceReader,
  ) {}

  async retrieveWindow(request: SemanticWindowRequest): Promise<SemanticWindow | undefined> {
    const symbols = this.selectSymbols(request);
    const file = this.store.getFile(request.filePath);
    if (!file) return undefined;

    const radius = request.radiusLines ?? 8;
    const startLine = Math.max(1, Math.min(...symbols.map((symbol) => symbol.startLine), 1) - radius);
    const endLine = Math.max(...symbols.map((symbol) => symbol.endLine), startLine) + radius;
    const dependencies = request.includeDependencies === false ? [] : this.store.getDependenciesForFile(request.filePath);
    const summary = [
      `${request.filePath}:${startLine}-${endLine}`,
      `symbols: ${symbols.map((symbol) => `${symbol.type}:${symbol.name}`).join(', ') || 'none'}`,
      `dependencies: ${dependencies.map((dep) => dep.targetPath).slice(0, 6).join(', ') || 'none'}`,
      file.summary ? `semantic: ${file.summary}` : undefined,
    ].filter(Boolean).join('\n');
    const source = this.sourceReader ? await this.sourceReader(request.filePath, startLine, endLine) : undefined;
    const content = source ? `${summary}\n${source}` : summary;

    return {
      filePath: request.filePath,
      symbols,
      dependencies,
      startLine,
      endLine,
      summary,
      source,
      tokenEstimate: Math.ceil(content.length / 4),
    };
  }

  private selectSymbols(request: SemanticWindowRequest): SymbolRecord[] {
    const all = this.store.getSymbolsForFile(request.filePath);
    if (request.symbolName) {
      const exact = all.filter((symbol) => symbol.name === request.symbolName);
      if (exact.length > 0) return exact;
      const fuzzy = all.filter((symbol) => symbol.name.toLowerCase().includes(request.symbolName!.toLowerCase()));
      if (fuzzy.length > 0) return fuzzy;
    }

    if (request.intent) {
      const terms = request.intent.toLowerCase().split(/\W+/).filter(Boolean);
      const matched = all.filter((symbol) => terms.some((term) => symbol.name.toLowerCase().includes(term)));
      if (matched.length > 0) return matched;
    }

    return all.filter((symbol) => symbol.isExported).slice(0, 5);
  }
}
