import type { BrainStore, FileRecord } from '../persistence/BrainStore.js';
import { SemanticFileMapEngine, type SemanticFileMapEntry } from '../indexing/SemanticFileMapEngine.js';

export interface GraphRetrievalOptions {
  maxDepth?: number;
  maxFiles?: number;
  includeImporters?: boolean;
}

export interface GraphRetrievalResult {
  intent: string;
  files: FileRecord[];
  semanticEntries: SemanticFileMapEntry[];
  context: string;
  traversedEdges: number;
  tokenEstimate: number;
}

export class GraphDirectedRetrieval {
  private readonly semanticMap: SemanticFileMapEngine;

  constructor(private readonly store: BrainStore, semanticMap?: SemanticFileMapEngine) {
    this.semanticMap = semanticMap ?? new SemanticFileMapEngine(store);
  }

  retrieve(intent: string, options: GraphRetrievalOptions = {}): GraphRetrievalResult {
    const maxDepth = options.maxDepth ?? 2;
    const maxFiles = options.maxFiles ?? 12;
    const seeds = this.findSeedFiles(intent).slice(0, maxFiles);
    const visited = new Set<string>();
    const queue = seeds.map((file) => ({ path: file.path, depth: 0 }));
    let traversedEdges = 0;

    while (queue.length > 0 && visited.size < maxFiles) {
      const current = queue.shift()!;
      if (visited.has(current.path) || current.depth > maxDepth) continue;
      visited.add(current.path);

      const outgoing = this.store.getDependenciesForFile(current.path);
      const incoming = options.includeImporters === false ? [] : this.store.getImportersOf(current.path);
      for (const edge of [...outgoing, ...incoming]) {
        traversedEdges++;
        const nextPath = edge.sourcePath === current.path ? edge.targetPath : edge.sourcePath;
        if (!visited.has(nextPath) && current.depth < maxDepth) {
          queue.push({ path: nextPath, depth: current.depth + 1 });
        }
      }
    }

    const files = Array.from(visited)
      .map((filePath) => this.store.getFile(filePath))
      .filter((file): file is FileRecord => Boolean(file))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxFiles);
    const semanticEntries = files
      .map((file) => this.semanticMap.getFileMap(file.path))
      .filter((entry): entry is SemanticFileMapEntry => Boolean(entry));
    const context = semanticEntries.map((entry) => this.semanticMap.summarize(entry)).join('\n\n');

    return {
      intent,
      files,
      semanticEntries,
      context,
      traversedEdges,
      tokenEstimate: Math.ceil(context.length / 4),
    };
  }

  private findSeedFiles(intent: string): FileRecord[] {
    const keywords = this.extractKeywords(intent);
    const byPath = new Map<string, FileRecord>();

    for (const keyword of keywords) {
      for (const symbol of this.store.searchSymbols(keyword)) {
        const file = this.store.getFile(symbol.filePath);
        if (file) byPath.set(file.path, file);
      }
      for (const file of this.store.searchFiles(keyword)) {
        byPath.set(file.path, file);
      }
    }

    if (byPath.size === 0) {
      for (const file of this.store.getAllFiles().sort((a, b) => b.importance - a.importance).slice(0, 4)) {
        byPath.set(file.path, file);
      }
    }

    return Array.from(byPath.values()).sort((a, b) => b.importance - a.importance);
  }

  private extractKeywords(intent: string): string[] {
    const stop = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'implement', 'create', 'update']);
    return Array.from(new Set(intent.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !stop.has(word))));
  }
}
