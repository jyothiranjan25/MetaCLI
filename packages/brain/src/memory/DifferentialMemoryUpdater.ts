import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { EventBus, MetaCLIEvents } from '@metacli/core';
import type { BrainStore, DependencyRecord, SymbolRecord } from '../persistence/BrainStore.js';
import { AstSymbolIndexer } from '../indexing/AstSymbolIndexer.js';
import { SemanticFileMapEngine } from '../indexing/SemanticFileMapEngine.js';

export interface DifferentialUpdate {
  changedFiles: string[];
  deletedFiles: string[];
  unchangedFiles: number;
  updatedSymbols: number;
  updatedDependencies: number;
}

export class DifferentialMemoryUpdater {
  private readonly indexer = new AstSymbolIndexer();
  private readonly semanticMap: SemanticFileMapEngine;

  constructor(
    private readonly projectRoot: string,
    private readonly store: BrainStore,
    private readonly eventBus?: EventBus<MetaCLIEvents>,
    semanticMap?: SemanticFileMapEngine,
  ) {
    this.semanticMap = semanticMap ?? new SemanticFileMapEngine(store);
  }

  async update(filePaths: string[]): Promise<DifferentialUpdate> {
    const changedFiles: string[] = [];
    const deletedFiles: string[] = [];
    let unchangedFiles = 0;
    let updatedSymbols = 0;
    let updatedDependencies = 0;

    for (const inputPath of filePaths) {
      const relativePath = path.isAbsolute(inputPath) ? path.relative(this.projectRoot, inputPath) : inputPath;
      const absolutePath = path.join(this.projectRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        this.store.deleteFile(relativePath);
        deletedFiles.push(relativePath);
        continue;
      }

      const content = fs.readFileSync(absolutePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const existing = this.store.getFile(relativePath);
      if (existing?.hash === hash) {
        unchangedFiles++;
        continue;
      }

      const stats = fs.statSync(absolutePath);
      const parseResult = this.indexer.parseFile(absolutePath, this.projectRoot);
      const symbols: SymbolRecord[] = parseResult.symbols.map((symbol) => ({ ...symbol, filePath: relativePath }));
      const dependencies: DependencyRecord[] = parseResult.dependencies.map((dependency) => ({ ...dependency, sourcePath: relativePath }));

      this.store.transaction(() => {
        this.store.saveFile({ path: relativePath, hash, size: stats.size });
        this.store.clearFileIndex(relativePath);
        this.store.saveSymbols(symbols);
        this.store.saveDependencies(dependencies);
      });
      this.semanticMap.buildFileMap(relativePath);
      changedFiles.push(relativePath);
      updatedSymbols += symbols.length;
      updatedDependencies += dependencies.length;
    }

    if (changedFiles.length > 0 || deletedFiles.length > 0) {
      this.store.updateImportanceScores();
      await this.eventBus?.emit('brain:memory_updated', {
        tier: 'differential',
        entriesChanged: changedFiles.length + deletedFiles.length,
      });
    }

    return { changedFiles, deletedFiles, unchangedFiles, updatedSymbols, updatedDependencies };
  }
}
