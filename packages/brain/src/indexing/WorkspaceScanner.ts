import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { type BrainStore, type SymbolRecord, type DependencyRecord } from '../persistence/BrainStore.js';
import { AstSymbolIndexer } from './AstSymbolIndexer.js';
import { type EventBus, type MetaCLIEvents, PathGuard } from '@metacli/core';


export interface ScanOptions {
  excludePatterns?: string[];
  forceRescan?: boolean;
}

export class WorkspaceScanner {
  private indexer = new AstSymbolIndexer();
  private defaultExcludes = [
    '.git',
    'node_modules',
    'dist',
    'build',
    '.turbo',
    '.metacli',
    '.DS_Store',
    'coverage',
    'out',
  ];

  constructor(
    private projectRoot: string,
    private store: BrainStore,
    private eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  /**
   * Run a full or incremental scan on the workspace.
   * Yields scan progress events.
   */
  async scan(options: ScanOptions = {}): Promise<{ filesScanned: number; filesUpdated: number; durationMs: number }> {
    const startTime = Date.now();
    const excludes = new Set([...this.defaultExcludes, ...(options.excludePatterns ?? [])]);

    await this.eventBus?.emit('brain:scan_start', { projectPath: this.projectRoot });

    // 1. Traverse directory to find all indexable files
    const allFiles: string[] = [];
    this.crawlDirectory(this.projectRoot, excludes, allFiles);

    const totalFiles = allFiles.length;
    let filesUpdated = 0;
    
    // 2. Fetch existing files from DB to detect deletions and avoid duplicates
    const dbFiles = this.store.getAllFiles();
    const dbFileMap = new Map(dbFiles.map((f) => [f.path, f]));
    const scannedPaths = new Set(allFiles.map((f) => path.relative(this.projectRoot, f)));

    // 3. Delete DB entries for files that no longer exist on disk
    this.store.transaction(() => {
      for (const dbFile of dbFiles) {
        if (!scannedPaths.has(dbFile.path)) {
          this.store.deleteFile(dbFile.path);
        }
      }
    });

    // 4. Scan and index files
    for (let i = 0; i < totalFiles; i++) {
      const absolutePath = allFiles[i];
      const relativePath = path.relative(this.projectRoot, absolutePath);
      
      try {
        const stats = fs.statSync(absolutePath);
        const fileContent = fs.readFileSync(absolutePath);
        const hash = this.calculateHash(fileContent);

        const existing = dbFileMap.get(relativePath);
        const needsUpdate = options.forceRescan || !existing || existing.hash !== hash;

        if (needsUpdate) {
          // Parse file
          const parseResult = this.indexer.parseFile(absolutePath, this.projectRoot);
          
          this.store.transaction(() => {
            // Save file record
            this.store.saveFile({
              path: relativePath,
              hash,
              size: stats.size,
            });

            // Clear old index
            this.store.clearFileIndex(relativePath);

            // Save new symbols
            const symbols: SymbolRecord[] = parseResult.symbols.map((sym) => ({
              ...sym,
              filePath: relativePath,
            }));
            this.store.saveSymbols(symbols);

            // Save new dependencies
            const dependencies: DependencyRecord[] = parseResult.dependencies.map((dep) => ({
              ...dep,
              sourcePath: relativePath,
            }));
            this.store.saveDependencies(dependencies);
          });

          filesUpdated++;
        }
      } catch {
        // Defensive skip on read/stat error
      }

      // Emit periodic progress events
      if (i % 10 === 0 || i === totalFiles - 1) {
        await this.eventBus?.emit('brain:scan_progress', {
          phase: 'hashing_indexing',
          progress: totalFiles > 0 ? (i + 1) / totalFiles : 1,
          detail: `Indexing ${relativePath.slice(-30)}`,
        });
      }
    }

    // 5. Calculate PageRank-style importance scores
    await this.eventBus?.emit('brain:scan_progress', {
      phase: 'optimizing_graph',
      progress: 0.95,
      detail: 'Re-calculating module importance scores',
    });
    this.store.updateImportanceScores();

    const durationMs = Date.now() - startTime;

    await this.eventBus?.emit('brain:scan_complete', {
      fileCount: totalFiles,
      symbolCount: 0, // Placeholder or calculated from DB
      durationMs,
    });

    return {
      filesScanned: totalFiles,
      filesUpdated,
      durationMs,
    };
  }

  // ─── Private Methods ─────────────────────────────────────────

  /**
   * Recursively crawl a directory to find indexable code files.
   */
  private crawlDirectory(dir: string, excludes: Set<string>, fileList: string[]): void {
    if (!PathGuard.isPathAllowed(dir, this.projectRoot)) {
      return;
    }

    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return; // Skip folders that cannot be read
    }

    for (const file of files) {
      const absolutePath = path.join(dir, file);
      const relativePath = path.relative(this.projectRoot, absolutePath);
      
      // Skip if explicitly excluded
      if (excludes.has(file) || excludes.has(relativePath)) {
        continue;
      }

      // Enforce PathGuard isolation
      if (!PathGuard.isPathAllowed(absolutePath, this.projectRoot)) {
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        this.crawlDirectory(absolutePath, excludes, fileList);
      } else if (stat.isFile() && this.isIndexable(file)) {
        fileList.push(absolutePath);
      }
    }
  }

  /**
   * Determine if a file extension is supported by our indexers.
   */
  private isIndexable(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    const indexableExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
    ];
    return indexableExtensions.includes(extension);
  }

  /**
   * Calculate SHA-256 hash.
   */
  private calculateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
