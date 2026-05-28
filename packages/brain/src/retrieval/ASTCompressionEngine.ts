import type { BrainStore, DependencyRecord, SymbolRecord } from '../persistence/BrainStore.js';

export interface ASTCompressedRegion {
  filePath: string;
  summary: string;
  exportedContracts: string[];
  dependencies: string[];
  tokenEstimate: number;
}

export class ASTCompressionEngine {
  constructor(private readonly store: BrainStore) {}

  compressFile(filePath: string): ASTCompressedRegion | undefined {
    const file = this.store.getFile(filePath);
    if (!file) return undefined;
    const symbols = this.store.getSymbolsForFile(filePath);
    const dependencies = this.store.getDependenciesForFile(filePath);
    const exported = symbols.filter((symbol) => symbol.isExported);
    const summary = this.summarize(filePath, symbols, dependencies);
    return {
      filePath,
      summary,
      exportedContracts: exported.map((symbol) => `${symbol.type}:${symbol.name}@${symbol.startLine}-${symbol.endLine}`),
      dependencies: dependencies.map((dependency) => dependency.targetPath),
      tokenEstimate: Math.ceil(summary.length / 4),
    };
  }

  compressFiles(filePaths: string[]): ASTCompressedRegion[] {
    return filePaths
      .map((filePath) => this.compressFile(filePath))
      .filter((region): region is ASTCompressedRegion => Boolean(region));
  }

  private summarize(filePath: string, symbols: SymbolRecord[], dependencies: DependencyRecord[]): string {
    const exports = symbols.filter((symbol) => symbol.isExported);
    const contracts = exports.length > 0 ? exports : symbols.slice(0, 8);
    const contractText = contracts.map((symbol) => `${symbol.type} ${symbol.name} lines ${symbol.startLine}-${symbol.endLine}`).join('; ') || 'no indexed symbols';
    const depText = dependencies.map((dependency) => dependency.targetPath).slice(0, 8).join(', ') || 'no direct dependencies';
    return `${filePath}: contracts [${contractText}], depends on [${depText}]`;
  }
}
