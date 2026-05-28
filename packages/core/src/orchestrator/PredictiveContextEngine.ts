/**
 * MetaCLI Core — Predictive Context Preloader
 *
 * Scans active buffers and file structures post-change to proactively load
 * related symbols and context vectors prior to prompt entry.
 */

export class PredictiveContextEngine {
  private brainStore: any;
  private eventBus: any;
  private cache = new Map<string, string[]>();

  constructor(brainStore: any, eventBus?: any) {
    this.brainStore = brainStore;
    this.eventBus = eventBus;
  }

  /**
   * Proactively predicts and loads contextual files related to the active file.
   */
  async preloadContext(activeFilePath: string): Promise<string[]> {
    if (this.cache.has(activeFilePath)) {
      return this.cache.get(activeFilePath)!;
    }

    const predictedPaths: string[] = [];

    // 1. Fetch direct dependencies of the active file
    try {
      const deps = this.brainStore.getAllDependencies();
      const directDeps = deps
        .filter((d: any) => d.sourcePath === activeFilePath)
        .map((d: any) => d.targetPath);
      
      predictedPaths.push(...directDeps);
    } catch {
      // Index might be blank initially — that's fine
    }

    // 2. Fetch sibling files in the same workspace directory
    try {
      const fileRecord = this.brainStore.getFile(activeFilePath);
      if (fileRecord) {
        const keyword = activeFilePath.substring(0, activeFilePath.lastIndexOf('/'));
        if (keyword) {
          const siblings = this.brainStore.searchFiles(keyword);
          for (const sib of siblings) {
            if (sib.path !== activeFilePath && !predictedPaths.includes(sib.path)) {
              predictedPaths.push(sib.path);
            }
          }
        }
      }
    } catch {
      // Skip sibling searches
    }

    const results = predictedPaths.slice(0, 10);
    this.cache.set(activeFilePath, results);

    if (this.eventBus) {
      this.eventBus.emit('context.preloaded', {
        filePath: activeFilePath,
        matchedSymbols: results.length,
      });
    }

    return results;
  }
}
