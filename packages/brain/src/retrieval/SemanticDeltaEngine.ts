import type { BrainStore, DependencyRecord, SymbolRecord } from '../persistence/BrainStore.js';

export interface SemanticSnapshot {
  filePath: string;
  hash: string;
  symbols: SymbolRecord[];
  dependencies: DependencyRecord[];
  summary?: string;
}

export interface SemanticDelta {
  filePath: string;
  changed: boolean;
  changedSymbols: SymbolRecord[];
  removedSymbols: SymbolRecord[];
  addedDependencies: DependencyRecord[];
  removedDependencies: DependencyRecord[];
  modifiedInterfaces: SymbolRecord[];
  minimalContext: string;
  tokenEstimate: number;
}

export class SemanticDeltaEngine {
  constructor(private readonly store: BrainStore) {}

  snapshot(filePath: string): SemanticSnapshot | undefined {
    const file = this.store.getFile(filePath);
    if (!file) return undefined;
    return {
      filePath,
      hash: file.hash,
      symbols: this.store.getSymbolsForFile(filePath),
      dependencies: this.store.getDependenciesForFile(filePath),
      summary: file.summary,
    };
  }

  diff(previous: SemanticSnapshot, current: SemanticSnapshot = this.snapshot(previous.filePath)!): SemanticDelta {
    const previousSymbols = new Map(previous.symbols.map((symbol) => [this.symbolKey(symbol), symbol]));
    const currentSymbols = new Map(current.symbols.map((symbol) => [this.symbolKey(symbol), symbol]));
    const previousDeps = new Map(previous.dependencies.map((dependency) => [this.depKey(dependency), dependency]));
    const currentDeps = new Map(current.dependencies.map((dependency) => [this.depKey(dependency), dependency]));

    const changedSymbols = current.symbols.filter((symbol) => {
      const old = previousSymbols.get(this.symbolKey(symbol));
      return !old || old.startLine !== symbol.startLine || old.endLine !== symbol.endLine || old.isExported !== symbol.isExported;
    });
    const removedSymbols = previous.symbols.filter((symbol) => !currentSymbols.has(this.symbolKey(symbol)));
    const addedDependencies = current.dependencies.filter((dependency) => !previousDeps.has(this.depKey(dependency)));
    const removedDependencies = previous.dependencies.filter((dependency) => !currentDeps.has(this.depKey(dependency)));
    const modifiedInterfaces = changedSymbols.filter((symbol) => symbol.type === 'interface' || symbol.type === 'type' || symbol.isExported);
    const changed = previous.hash !== current.hash || changedSymbols.length > 0 || removedSymbols.length > 0 || addedDependencies.length > 0 || removedDependencies.length > 0;
    const minimalContext = this.formatDelta(current.filePath, changedSymbols, removedSymbols, addedDependencies, removedDependencies, modifiedInterfaces);

    return {
      filePath: current.filePath,
      changed,
      changedSymbols,
      removedSymbols,
      addedDependencies,
      removedDependencies,
      modifiedInterfaces,
      minimalContext,
      tokenEstimate: Math.ceil(minimalContext.length / 4),
    };
  }

  diffMany(previousSnapshots: SemanticSnapshot[]): SemanticDelta[] {
    return previousSnapshots
      .map((snapshot) => {
        const current = this.snapshot(snapshot.filePath);
        return current ? this.diff(snapshot, current) : undefined;
      })
      .filter((delta): delta is SemanticDelta => Boolean(delta));
  }

  private formatDelta(
    filePath: string,
    changedSymbols: SymbolRecord[],
    removedSymbols: SymbolRecord[],
    addedDependencies: DependencyRecord[],
    removedDependencies: DependencyRecord[],
    modifiedInterfaces: SymbolRecord[],
  ): string {
    return [
      `semantic delta ${filePath}`,
      `changed symbols: ${changedSymbols.map((symbol) => `${symbol.type}:${symbol.name}@${symbol.startLine}-${symbol.endLine}`).join(', ') || 'none'}`,
      `removed symbols: ${removedSymbols.map((symbol) => `${symbol.type}:${symbol.name}`).join(', ') || 'none'}`,
      `modified interfaces: ${modifiedInterfaces.map((symbol) => symbol.name).join(', ') || 'none'}`,
      `added deps: ${addedDependencies.map((dependency) => dependency.targetPath).join(', ') || 'none'}`,
      `removed deps: ${removedDependencies.map((dependency) => dependency.targetPath).join(', ') || 'none'}`,
    ].join('\n');
  }

  private symbolKey(symbol: SymbolRecord): string {
    return `${symbol.type}:${symbol.name}`;
  }

  private depKey(dependency: DependencyRecord): string {
    return `${dependency.type}:${dependency.sourcePath}->${dependency.targetPath}`;
  }
}
