import type { BrainStore, DependencyRecord, FileRecord } from '../persistence/BrainStore.js';
import { SemanticFileMapEngine, type SemanticFileMapEntry } from './SemanticFileMapEngine.js';

export interface ArchitectureSummary {
  generatedAt: number;
  fileCount: number;
  dependencyCount: number;
  domainSummaries: string[];
  dependencySummary: string;
  workflowSummary: string;
  systemTopology: string;
}

export class ArchitectureSummaryCompiler {
  private readonly semanticMap: SemanticFileMapEngine;

  constructor(private readonly store: BrainStore, semanticMap?: SemanticFileMapEngine) {
    this.semanticMap = semanticMap ?? new SemanticFileMapEngine(store);
  }

  compile(): ArchitectureSummary {
    const files = this.store.getAllFiles();
    const dependencies = this.store.getAllDependencies();
    const entries = files
      .map((file) => this.semanticMap.getFileMap(file.path))
      .filter((entry): entry is SemanticFileMapEntry => Boolean(entry));

    const summary: ArchitectureSummary = {
      generatedAt: Date.now(),
      fileCount: files.length,
      dependencyCount: dependencies.length,
      domainSummaries: this.compileDomainSummaries(entries),
      dependencySummary: this.compileDependencySummary(files, dependencies),
      workflowSummary: this.compileWorkflowSummary(entries),
      systemTopology: this.compileTopology(entries, dependencies),
    };

    this.store.saveMemory({
      id: 'architecture-summary:latest',
      layer: 'warm',
      content: this.toMarkdown(summary),
      summary: summary.systemTopology,
      metadata: JSON.stringify({ kind: 'architecture-summary', generatedAt: summary.generatedAt }),
    });

    return summary;
  }

  toMarkdown(summary: ArchitectureSummary): string {
    return [
      `Architecture Summary (${new Date(summary.generatedAt).toISOString()})`,
      `Files: ${summary.fileCount}; dependencies: ${summary.dependencyCount}`,
      '',
      'Domains:',
      ...summary.domainSummaries.map((line) => `- ${line}`),
      '',
      `Dependency Summary: ${summary.dependencySummary}`,
      `Workflow Summary: ${summary.workflowSummary}`,
      `Topology: ${summary.systemTopology}`,
    ].join('\n');
  }

  private compileDomainSummaries(entries: SemanticFileMapEntry[]): string[] {
    const domains = new Map<string, SemanticFileMapEntry[]>();
    for (const entry of entries) {
      const current = domains.get(entry.domainRole) ?? [];
      current.push(entry);
      domains.set(entry.domainRole, current);
    }

    return Array.from(domains.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([domain, domainEntries]) => {
        const highRisk = domainEntries.filter((entry) => entry.riskClassification === 'high' || entry.riskClassification === 'critical').length;
        return `${domain}: ${domainEntries.length} files, ${highRisk} high-risk, tags ${this.topTags(domainEntries).join(', ') || 'general'}`;
      });
  }

  private compileDependencySummary(files: FileRecord[], dependencies: DependencyRecord[]): string {
    const byTarget = new Map<string, number>();
    for (const dep of dependencies) byTarget.set(dep.targetPath, (byTarget.get(dep.targetPath) ?? 0) + 1);
    const hubs = Array.from(byTarget.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([target, count]) => `${target}(${count})`);
    return `${dependencies.length} edges across ${files.length} files; main hubs: ${hubs.join(', ') || 'none'}`;
  }

  private compileWorkflowSummary(entries: SemanticFileMapEntry[]): string {
    const workflowEntries = entries.filter((entry) => entry.architecturalTags.includes('workflow') || entry.architecturalTags.includes('provider-orchestration'));
    return workflowEntries.map((entry) => entry.filePath).slice(0, 8).join(', ') || 'No explicit workflow topology indexed';
  }

  private compileTopology(entries: SemanticFileMapEntry[], dependencies: DependencyRecord[]): string {
    const domains = new Set(entries.map((entry) => entry.domainRole));
    return `${domains.size} semantic domains connected by ${dependencies.length} indexed dependency edges`;
  }

  private topTags(entries: SemanticFileMapEntry[]): string[] {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const tag of entry.architecturalTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag);
  }
}
