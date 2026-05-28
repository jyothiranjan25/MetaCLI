import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export interface FileRecord {
  path: string;
  hash: string;
  size: number;
  importance: number;
  summary?: string;
  lastIndexed?: string;
}

export interface SymbolRecord {
  name: string;
  type: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
}

export interface DependencyRecord {
  sourcePath: string;
  targetPath: string;
  type: string;
}

export interface ExecutionAudit {
  id: string;
  timestamp?: string;
  command: string;
  providerId?: string;
  riskLevel: string;
  riskReason?: string;
  approvedBy: string; // 'user' | 'auto-policy'
  snapshotKey?: string;
  status: string; // 'pending' | 'success' | 'failed' | 'rolled_back'
  durationMs?: number;
  outputSnippet?: string;
}

export interface MemoryRecord {
  id: string;
  timestamp?: string;
  layer: 'hot' | 'warm' | 'cold';
  content: string;
  summary?: string;
  embedding?: string; // JSON array of numbers
  metadata?: string; // JSON metadata
}

export interface GraphNode {
  id: string;
  type: string; // 'file' | 'symbol' | 'api' | 'decision' | 'developer'
  name: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relation: string; // 'imports' | 'declares' | 'depends_on' | 'solved_by'
  weight?: number;
}


export class BrainStore {
  private db: Database.Database;

  constructor(projectRoot: string) {
    const metaDir = path.join(projectRoot, '.metacli');
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
    }

    const dbPath = path.join(metaDir, 'brain.db');
    this.db = new Database(dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Create tables
    this.initializeSchema();
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Run operations inside a transaction.
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Save or update a file record.
   */
  saveFile(file: Omit<FileRecord, 'importance' | 'lastIndexed'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, hash, size)
      VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        hash = excluded.hash,
        size = excluded.size,
        last_indexed = CURRENT_TIMESTAMP
    `);
    stmt.run(file.path, file.hash, file.size);
  }

  /**
   * Delete a file and all its cascaded relations (symbols, dependencies).
   */
  deleteFile(filePath: string): void {
    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
    stmt.run(filePath);
  }

  /**
   * Retrieve a file record.
   */
  getFile(filePath: string): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT path, hash, size, importance, summary, last_indexed as lastIndexed FROM files WHERE path = ?');
    const row = stmt.get(filePath) as any;
    if (!row) return undefined;
    return {
      path: row.path,
      hash: row.hash,
      size: row.size,
      importance: row.importance,
      summary: row.summary || undefined,
      lastIndexed: row.lastIndexed,
    };
  }

  /**
   * Get all registered files with their hashes.
   */
  getAllFiles(): FileRecord[] {
    const stmt = this.db.prepare('SELECT path, hash, size, importance, summary, last_indexed as lastIndexed FROM files');
    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      path: row.path,
      hash: row.hash,
      size: row.size,
      importance: row.importance,
      summary: row.summary || undefined,
      lastIndexed: row.lastIndexed,
    }));
  }

  /**
   * Clear all indexed symbols and dependencies for a single file.
   * Typically done before re-indexing.
   */
  clearFileIndex(filePath: string): void {
    this.transaction(() => {
      this.db.prepare('DELETE FROM symbols WHERE file_path = ?').run(filePath);
      this.db.prepare('DELETE FROM dependencies WHERE source_path = ?').run(filePath);
    });
  }

  /**
   * Batch insert symbols for a file.
   */
  saveSymbols(symbols: SymbolRecord[]): void {
    if (symbols.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO symbols (id, name, type, file_path, start_line, end_line, is_exported)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.transaction(() => {
      for (const sym of symbols) {
        const id = `${sym.filePath}:${sym.name}`;
        stmt.run(id, sym.name, sym.type, sym.filePath, sym.startLine, sym.endLine, sym.isExported ? 1 : 0);
      }
    });
  }

  /**
   * Batch insert dependencies for a file.
   */
  saveDependencies(dependencies: DependencyRecord[]): void {
    if (dependencies.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO dependencies (source_path, target_path, type)
      VALUES (?, ?, ?)
      ON CONFLICT(source_path, target_path) DO NOTHING
    `);

    this.transaction(() => {
      for (const dep of dependencies) {
        stmt.run(dep.sourcePath, dep.targetPath, dep.type);
      }
    });
  }

  /**
   * Search for symbols matching a keyword (case-insensitive).
   */
  searchSymbols(keyword: string): SymbolRecord[] {
    const stmt = this.db.prepare(`
      SELECT name, type, file_path as filePath, start_line as startLine, end_line as endLine, is_exported as isExported
      FROM symbols
      WHERE name LIKE ?
      LIMIT 50
    `);
    const rows = stmt.all(`%${keyword}%`) as any[];
    return rows.map((row) => ({
      name: row.name,
      type: row.type,
      filePath: row.filePath,
      startLine: row.startLine,
      endLine: row.endLine,
      isExported: row.isExported === 1,
    }));
  }

  /**
   * Search for files matching a path keyword.
   */
  searchFiles(keyword: string): FileRecord[] {
    const stmt = this.db.prepare(`
      SELECT path, hash, size, importance, summary, last_indexed as lastIndexed
      FROM files
      WHERE path LIKE ?
      LIMIT 25
    `);
    const rows = stmt.all(`%${keyword}%`) as any[];
    return rows.map((row) => ({
      path: row.path,
      hash: row.hash,
      size: row.size,
      importance: row.importance,
      summary: row.summary || undefined,
      lastIndexed: row.lastIndexed,
    }));
  }

  /**
   * Retrieve all dependencies in the system.
   */
  getAllDependencies(): DependencyRecord[] {
    const stmt = this.db.prepare('SELECT source_path as sourcePath, target_path as targetPath, type FROM dependencies');
    return stmt.all() as DependencyRecord[];
  }

  /**
   * Save or update an execution audit record.
   */
  saveExecutionAudit(audit: ExecutionAudit): void {
    const stmt = this.db.prepare(`
      INSERT INTO execution_audits (id, command, provider_id, risk_level, risk_reason, approved_by, snapshot_key, status, duration_ms, output_snippet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        command = excluded.command,
        provider_id = excluded.provider_id,
        risk_level = excluded.risk_level,
        risk_reason = excluded.risk_reason,
        approved_by = excluded.approved_by,
        snapshot_key = excluded.snapshot_key,
        status = excluded.status,
        duration_ms = excluded.duration_ms,
        output_snippet = excluded.output_snippet
    `);
    stmt.run(
      audit.id,
      audit.command,
      audit.providerId || null,
      audit.riskLevel,
      audit.riskReason || null,
      audit.approvedBy,
      audit.snapshotKey || null,
      audit.status,
      audit.durationMs !== undefined ? audit.durationMs : null,
      audit.outputSnippet || null
    );
  }

  /**
   * Get an execution audit record by ID.
   */
  getExecutionAudit(id: string): ExecutionAudit | undefined {
    const stmt = this.db.prepare('SELECT id, timestamp, command, provider_id as providerId, risk_level as riskLevel, risk_reason as riskReason, approved_by as approvedBy, snapshot_key as snapshotKey, status, duration_ms as durationMs, output_snippet as outputSnippet FROM execution_audits WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      timestamp: row.timestamp,
      command: row.command,
      providerId: row.providerId || undefined,
      riskLevel: row.riskLevel,
      riskReason: row.riskReason || undefined,
      approvedBy: row.approvedBy,
      snapshotKey: row.snapshotKey || undefined,
      status: row.status,
      durationMs: row.durationMs !== null ? row.durationMs : undefined,
      outputSnippet: row.outputSnippet || undefined,
    };
  }

  /**
   * Get all execution audits, ordered latest first.
   */
  getAllExecutionAudits(): ExecutionAudit[] {
    const stmt = this.db.prepare('SELECT id, timestamp, command, provider_id as providerId, risk_level as riskLevel, risk_reason as riskReason, approved_by as approvedBy, snapshot_key as snapshotKey, status, duration_ms as durationMs, output_snippet as outputSnippet FROM execution_audits ORDER BY timestamp DESC');
    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      command: row.command,
      providerId: row.providerId || undefined,
      riskLevel: row.riskLevel,
      riskReason: row.riskReason || undefined,
      approvedBy: row.approvedBy,
      snapshotKey: row.snapshotKey || undefined,
      status: row.status,
      durationMs: row.durationMs !== null ? row.durationMs : undefined,
      outputSnippet: row.outputSnippet || undefined,
    }));
  }

  /**
   * Save or update a memory record.
   */
  saveMemory(memory: MemoryRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, layer, content, summary, embedding, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        layer = excluded.layer,
        content = excluded.content,
        summary = excluded.summary,
        embedding = excluded.embedding,
        metadata = excluded.metadata
    `);
    stmt.run(
      memory.id,
      memory.layer,
      memory.content,
      memory.summary || null,
      memory.embedding || null,
      memory.metadata || null
    );
  }

  /**
   * Get all memories in a given layer.
   */
  getMemoriesByLayer(layer: 'hot' | 'warm' | 'cold'): MemoryRecord[] {
    const stmt = this.db.prepare('SELECT id, timestamp, layer, content, summary, embedding, metadata FROM memories WHERE layer = ? ORDER BY timestamp DESC');
    const rows = stmt.all(layer) as any[];
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      layer: row.layer,
      content: row.content,
      summary: row.summary || undefined,
      embedding: row.embedding || undefined,
      metadata: row.metadata || undefined,
    }));
  }

  /**
   * Clear memories by layer.
   */
  clearMemoriesByLayer(layer: 'hot' | 'warm' | 'cold'): void {
    this.db.prepare('DELETE FROM memories WHERE layer = ?').run(layer);
  }

  /**
   * Update calculated file importance rankings (PageRank style, but in degree).
   */
  updateImportanceScores(): void {
    this.transaction(() => {
      // Clear all scores back to 1
      this.db.prepare('UPDATE files SET importance = 1').run();
      
      // Calculate incoming import degree and set as importance
      const stmt = this.db.prepare(`
        UPDATE files
        SET importance = 1 + (
          SELECT COUNT(*)
          FROM dependencies
          WHERE dependencies.target_path = files.path
        )
      `);
      stmt.run();
    });
  }

  /**
   * Save or update a graph node.
   */
  saveGraphNode(node: GraphNode): void {
    const stmt = this.db.prepare(`
      INSERT INTO graph_nodes (id, type, name, properties)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        properties = excluded.properties
    `);
    stmt.run(
      node.id,
      node.type,
      node.name,
      node.properties ? JSON.stringify(node.properties) : null
    );
  }

  /**
   * Get a graph node by ID.
   */
  getGraphNode(id: string): GraphNode | undefined {
    const stmt = this.db.prepare('SELECT id, type, name, properties FROM graph_nodes WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: row.properties ? JSON.parse(row.properties) : undefined,
    };
  }

  /**
   * Delete a graph node and all associated edges.
   */
  deleteGraphNode(id: string): void {
    const stmt = this.db.prepare('DELETE FROM graph_nodes WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Save or update a graph edge.
   */
  saveGraphEdge(edge: GraphEdge): void {
    const stmt = this.db.prepare(`
      INSERT INTO graph_edges (source_id, target_id, relation, weight)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
        weight = excluded.weight
    `);
    stmt.run(
      edge.sourceId,
      edge.targetId,
      edge.relation,
      edge.weight !== undefined ? edge.weight : 1.0
    );
  }

  /**
   * Retrieve graph edges, optionally filtering by sourceId and/or relation.
   */
  getGraphEdges(sourceId?: string, relation?: string): GraphEdge[] {
    let query = 'SELECT source_id as sourceId, target_id as targetId, relation, weight FROM graph_edges';
    const params: any[] = [];
    const conditions: string[] = [];

    if (sourceId) {
      conditions.push('source_id = ?');
      params.push(sourceId);
    }
    if (relation) {
      conditions.push('relation = ?');
      params.push(relation);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => ({
      sourceId: row.sourceId,
      targetId: row.targetId,
      relation: row.relation,
      weight: row.weight,
    }));
  }

  /**
   * Delete a graph edge.
   */
  deleteGraphEdge(sourceId: string, targetId: string, relation: string): void {
    const stmt = this.db.prepare('DELETE FROM graph_edges WHERE source_id = ? AND target_id = ? AND relation = ?');
    stmt.run(sourceId, targetId, relation);
  }

  // ─── Private Methods ─────────────────────────────────────────

  private initializeSchema(): void {
    // 1. Files table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        importance INTEGER DEFAULT 1,
        summary TEXT,
        last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Symbols table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        is_exported BOOLEAN NOT NULL,
        FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `).run();

    // 3. Dependencies table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS dependencies (
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        type TEXT NOT NULL,
        PRIMARY KEY (source_path, target_path),
        FOREIGN KEY(source_path) REFERENCES files(path) ON DELETE CASCADE
      )
    `).run();

    // Create indexes for faster queries
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_symbols_file_path ON symbols(file_path)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_dependencies_target ON dependencies(target_path)').run();

    // 4. Execution audits table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS execution_audits (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        command TEXT NOT NULL,
        provider_id TEXT,
        risk_level TEXT NOT NULL,
        risk_reason TEXT,
        approved_by TEXT NOT NULL,
        snapshot_key TEXT,
        status TEXT NOT NULL,
        duration_ms INTEGER,
        output_snippet TEXT
      )
    `).run();

    // 5. Memories table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        layer TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        embedding TEXT,
        metadata TEXT
      )
    `).run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_audits_time ON execution_audits(timestamp)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_memories_layer ON memories(layer)').run();

    // 6. Graph Nodes table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT
      )
    `).run();

    // 7. Graph Edges table
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS graph_edges (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (source_id, target_id, relation),
        FOREIGN KEY(source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY(target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
      )
    `).run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id)').run();
  }
}
