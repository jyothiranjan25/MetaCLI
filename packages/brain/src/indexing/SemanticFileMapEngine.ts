import path from 'node:path';
import type { BrainStore, DependencyRecord, FileRecord, SymbolRecord } from '../persistence/BrainStore.js';

export type RiskClassification = 'low' | 'medium' | 'high' | 'critical';

export interface SemanticFileMapEntry {
  filePath: string;
  semanticPurpose: string;
  domainRole: string;
  dependencies: DependencyRecord[];
  importers: DependencyRecord[];
  exportedContracts: SymbolRecord[];
  architecturalTags: string[];
  riskClassification: RiskClassification;
  ownershipMetadata: {
    packageName?: string;
    directory: string;
    lastIndexed?: string;
    importance: number;
  };
}

export class SemanticFileMapEngine {
  constructor(private readonly store: BrainStore) {}

  buildFileMap(filePath: string): SemanticFileMapEntry | undefined {
    const file = this.store.getFile(filePath);
    if (!file) return undefined;

    const symbols = this.store.getSymbolsForFile(filePath);
    const dependencies = this.store.getDependenciesForFile(filePath);
    const importers = this.store.getImportersOf(filePath);
    const exportedContracts = symbols.filter((symbol) => symbol.isExported);
    const architecturalTags = this.deriveTags(file, symbols, dependencies, importers);
    const entry: SemanticFileMapEntry = {
      filePath,
      semanticPurpose: this.describePurpose(file, symbols, architecturalTags),
      domainRole: this.deriveDomainRole(file.path, architecturalTags),
      dependencies,
      importers,
      exportedContracts,
      architecturalTags,
      riskClassification: this.classifyRisk(file, exportedContracts, dependencies, importers),
      ownershipMetadata: {
        packageName: this.derivePackageName(file.path),
        directory: path.dirname(file.path),
        lastIndexed: file.lastIndexed,
        importance: file.importance,
      },
    };

    this.persist(entry);
    return entry;
  }

  buildWorkspaceMap(): SemanticFileMapEntry[] {
    return this.store
      .getAllFiles()
      .map((file) => this.buildFileMap(file.path))
      .filter((entry): entry is SemanticFileMapEntry => Boolean(entry));
  }

  getFileMap(filePath: string): SemanticFileMapEntry | undefined {
    const node = this.store.getGraphNode(`semantic-file:${filePath}`);
    if (!node?.properties) return this.buildFileMap(filePath);
    return node.properties as SemanticFileMapEntry;
  }

  summarize(entry: SemanticFileMapEntry): string {
    const exports = entry.exportedContracts.map((symbol) => `${symbol.type}:${symbol.name}`).join(', ') || 'none';
    const deps = entry.dependencies.map((dep) => dep.targetPath).slice(0, 8).join(', ') || 'none';
    const tags = entry.architecturalTags.join(', ') || 'general';
    return [
      `${entry.filePath}`,
      `purpose: ${entry.semanticPurpose}`,
      `domain: ${entry.domainRole}`,
      `tags: ${tags}`,
      `exports: ${exports}`,
      `deps: ${deps}`,
      `risk: ${entry.riskClassification}`,
    ].join('\n');
  }

  private persist(entry: SemanticFileMapEntry): void {
    const summary = this.summarize(entry);
    this.store.updateFileSummary(entry.filePath, summary);
    this.store.saveGraphNode({
      id: `semantic-file:${entry.filePath}`,
      type: 'semantic_file',
      name: entry.filePath,
      properties: entry,
    });
  }

  private describePurpose(file: FileRecord, symbols: SymbolRecord[], tags: string[]): string {
    const exported = symbols.filter((symbol) => symbol.isExported);
    const primary = exported[0] ?? symbols[0];
    if (primary) {
      return `Provides ${primary.type} ${primary.name} for ${this.deriveDomainRole(file.path, tags)}`;
    }
    return `Supports ${this.deriveDomainRole(file.path, tags)} without exported contracts`;
  }

  private deriveTags(
    file: FileRecord,
    symbols: SymbolRecord[],
    dependencies: DependencyRecord[],
    importers: DependencyRecord[],
  ): string[] {
    const haystack = [file.path, ...symbols.map((s) => s.name), ...dependencies.map((d) => d.targetPath)].join(' ').toLowerCase();
    const tags = new Set<string>();
    const rules: Array<[string, RegExp]> = [
      ['auth-domain', /auth|jwt|session|token/],
      ['provider-orchestration', /provider|adapter|router|fallback/],
      ['retrieval', /retrieval|context|search|query/],
      ['memory', /memory|cache|brain|semantic|summary/],
      ['indexing', /index|scan|ast|symbol|graph/],
      ['security', /security|guard|risk|audit|sanitize/],
      ['ui', /ui|view|overlay|dashboard|tsx/],
      ['workflow', /workflow|planner|step/],
      ['telemetry', /telemetry|usage|metric|analytics|score/],
      ['persistence', /store|sqlite|db|persistence/],
    ];

    for (const [tag, pattern] of rules) {
      if (pattern.test(haystack)) tags.add(tag);
    }
    if (symbols.some((symbol) => symbol.isExported)) tags.add('exports-contracts');
    if (dependencies.length > 5) tags.add('dependency-heavy');
    if (importers.length > 5) tags.add('high-fan-in');
    return Array.from(tags);
  }

  private deriveDomainRole(filePath: string, tags: string[]): string {
    if (tags.includes('auth-domain')) return 'authentication-domain';
    if (tags.includes('provider-orchestration')) return 'provider-orchestration';
    if (tags.includes('retrieval')) return 'context-retrieval';
    if (tags.includes('memory')) return 'persistent-memory';
    if (tags.includes('indexing')) return 'repository-indexing';
    if (tags.includes('security')) return 'execution-security';
    if (tags.includes('ui')) return 'interactive-interface';
    if (tags.includes('telemetry')) return 'runtime-telemetry';
    return filePath.split('/').slice(0, 3).join('/') || 'general-system';
  }

  private classifyRisk(
    file: FileRecord,
    exportedContracts: SymbolRecord[],
    dependencies: DependencyRecord[],
    importers: DependencyRecord[],
  ): RiskClassification {
    const score = file.importance + exportedContracts.length * 2 + importers.length * 3 + dependencies.length;
    if (score >= 35) return 'critical';
    if (score >= 20) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  private derivePackageName(filePath: string): string | undefined {
    const parts = filePath.split('/');
    if (parts[0] === 'packages' || parts[0] === 'apps') return parts.slice(0, 2).join('/');
    return undefined;
  }
}
