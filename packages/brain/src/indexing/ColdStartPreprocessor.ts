import type { EventBus, MetaCLIEvents } from '@metacli/core';
import type { BrainStore } from '../persistence/BrainStore.js';
import { WorkspaceScanner, type ScanOptions } from './WorkspaceScanner.js';
import { SemanticFileMapEngine } from './SemanticFileMapEngine.js';
import { ArchitectureSummaryCompiler, type ArchitectureSummary } from './ArchitectureSummaryCompiler.js';

export interface ColdStartResult {
  filesScanned: number;
  filesUpdated: number;
  semanticFilesUpdated: number;
  architectureSummary: ArchitectureSummary;
  durationMs: number;
  mode: 'cold-start' | 'incremental';
}

export class ColdStartPreprocessor {
  private readonly scanner: WorkspaceScanner;
  private readonly semanticMap: SemanticFileMapEngine;
  private readonly summaryCompiler: ArchitectureSummaryCompiler;

  constructor(
    projectRoot: string,
    private readonly store: BrainStore,
    private readonly eventBus?: EventBus<MetaCLIEvents>,
  ) {
    this.scanner = new WorkspaceScanner(projectRoot, store, eventBus);
    this.semanticMap = new SemanticFileMapEngine(store);
    this.summaryCompiler = new ArchitectureSummaryCompiler(store, this.semanticMap);
  }

  async prepare(options: ScanOptions = {}): Promise<ColdStartResult> {
    const start = Date.now();
    const alreadyIndexed = this.store.getAllFiles().length > 0;
    const mode: ColdStartResult['mode'] = alreadyIndexed && !options.forceRescan ? 'incremental' : 'cold-start';
    const scan = await this.scanner.scan({ ...options, forceRescan: options.forceRescan ?? !alreadyIndexed });
    const semanticFilesUpdated = this.rebuildSemanticLayer(scan.filesUpdated > 0 || mode === 'cold-start');
    const architectureSummary = this.summaryCompiler.compile();
    const durationMs = Date.now() - start;

    await this.eventBus?.emit('brain:memory_updated', {
      tier: 'semantic-cognition',
      entriesChanged: semanticFilesUpdated,
    });

    return {
      filesScanned: scan.filesScanned,
      filesUpdated: scan.filesUpdated,
      semanticFilesUpdated,
      architectureSummary,
      durationMs,
      mode,
    };
  }

  private rebuildSemanticLayer(rebuildAll: boolean): number {
    const files = this.store.getAllFiles();
    let updated = 0;
    for (const file of files) {
      if (rebuildAll || !file.summary) {
        if (this.semanticMap.buildFileMap(file.path)) updated++;
      }
    }
    return updated;
  }
}
