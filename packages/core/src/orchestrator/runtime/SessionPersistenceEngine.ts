/**
 * MetaCLI Core — Session Persistence Engine
 *
 * Persists session metadata, conversation history, routing metadata, token usage,
 * and health state into an offline SQLite database.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { GlobalStorage } from '../../runtime/GlobalStorage.js';
import type { TokenUsageRecord } from './TokenAccountingEngine.js';
import type { HealthStatus } from '../../events/types.js';

export interface PersistentSessionRecord {
  id: string;
  providerId: string;
  state: string;
  promptsSent: number;
  tokenCount: number;
  updatedAt: string;
}

export class SessionPersistenceEngine {
  private db: Database.Database;

  constructor(dbPath?: string) {
    let finalPath = dbPath;
    if (!finalPath) {
      const storage = new GlobalStorage();
      storage.initialize();
      finalPath = storage.getPath('sessions', 'sessions.db');
    }

    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  /**
   * Close database connection.
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Save session state.
   */
  public saveSession(
    id: string,
    providerId: string,
    state: string,
    promptsSent: number,
    tokenCount: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, provider_id, state, prompts_sent, token_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        prompts_sent = excluded.prompts_sent,
        token_count = excluded.token_count,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(id, providerId, state, promptsSent, tokenCount);
  }

  /**
   * Load a session record.
   */
  public getSession(id: string): PersistentSessionRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT id, provider_id as providerId, state, prompts_sent as promptsSent, token_count as tokenCount, updated_at as updatedAt
      FROM sessions
      WHERE id = ?
    `);
    return stmt.get(id) as PersistentSessionRecord | undefined;
  }

  /**
   * Load all session records.
   */
  public getAllSessions(): PersistentSessionRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, provider_id as providerId, state, prompts_sent as promptsSent, token_count as tokenCount, updated_at as updatedAt
      FROM sessions
      ORDER BY updated_at DESC
    `);
    return stmt.all() as PersistentSessionRecord[];
  }

  /**
   * Record a prompt sent to a session.
   */
  public recordPrompt(
    sessionId: string,
    prompt: string,
    systemPrompt?: string,
    files?: string[],
    workingDirectory?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO session_prompts (session_id, prompt, system_prompt, files, working_directory)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      sessionId,
      prompt,
      systemPrompt || null,
      files ? JSON.stringify(files) : null,
      workingDirectory || null
    );
  }

  /**
   * Get history for a session.
   */
  public getSessionHistory(sessionId: string): Array<{
    prompt: string;
    systemPrompt?: string;
    files?: string[];
    workingDirectory?: string;
    timestamp: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT prompt, system_prompt as systemPrompt, files, working_directory as workingDirectory, timestamp
      FROM session_prompts
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sessionId) as any[];
    return rows.map((r) => ({
      prompt: r.prompt,
      systemPrompt: r.systemPrompt || undefined,
      files: r.files ? JSON.parse(r.files) : undefined,
      workingDirectory: r.workingDirectory || undefined,
      timestamp: r.timestamp,
    }));
  }

  /**
   * Save a token usage record.
   */
  public saveTokenUsage(record: TokenUsageRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO token_usage (provider_id, session_id, project_path, workflow_id, input_tokens, output_tokens, cost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.providerId,
      record.sessionId,
      record.projectPath,
      record.workflowId,
      record.inputTokens,
      record.outputTokens,
      record.cost,
      record.timestamp.toISOString()
    );
  }

  /**
   * Load all token usages.
   */
  public loadTokenUsages(): TokenUsageRecord[] {
    const stmt = this.db.prepare(`
      SELECT provider_id as providerId, session_id as sessionId, project_path as projectPath, workflow_id as workflowId, input_tokens as inputTokens, output_tokens as outputTokens, cost, timestamp
      FROM token_usage
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      providerId: r.providerId,
      sessionId: r.sessionId,
      projectPath: r.projectPath,
      workflowId: r.workflowId,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cost: r.cost,
      timestamp: new Date(r.timestamp),
    }));
  }

  /**
   * Save routing decision metadata.
   */
  public saveRoutingMetadata(sessionId: string, decision: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO routing_metadata (session_id, decision)
      VALUES (?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        decision = excluded.decision,
        timestamp = CURRENT_TIMESTAMP
    `);
    stmt.run(sessionId, JSON.stringify(decision));
  }

  /**
   * Retrieve routing decision metadata for a session.
   */
  public getRoutingMetadata(sessionId: string): any | undefined {
    const stmt = this.db.prepare(`SELECT decision FROM routing_metadata WHERE session_id = ?`);
    const row = stmt.get(sessionId) as any;
    if (row && row.decision) {
      return JSON.parse(row.decision);
    }
    return undefined;
  }

  /**
   * Save provider health status.
   */
  public saveProviderHealth(providerId: string, health: HealthStatus): void {
    const stmt = this.db.prepare(`
      INSERT INTO provider_health (provider_id, healthy, latency_ms, rate_limited, cooldown_until, score, last_checked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id) DO UPDATE SET
        healthy = excluded.healthy,
        latency_ms = excluded.latency_ms,
        rate_limited = excluded.rate_limited,
        cooldown_until = excluded.cooldown_until,
        score = excluded.score,
        last_checked = excluded.last_checked
    `);
    stmt.run(
      providerId,
      health.healthy ? 1 : 0,
      health.latencyMs !== undefined ? health.latencyMs : null,
      health.rateLimited ? 1 : 0,
      health.cooldownUntil ? health.cooldownUntil.toISOString() : null,
      health.score,
      health.lastChecked.toISOString()
    );
  }

  /**
   * Get provider health status.
   */
  public getProviderHealth(providerId: string): HealthStatus | undefined {
    const stmt = this.db.prepare(`
      SELECT healthy, latency_ms as latencyMs, rate_limited as rateLimited, cooldown_until as cooldownUntil, score, last_checked as lastChecked
      FROM provider_health
      WHERE provider_id = ?
    `);
    const row = stmt.get(providerId) as any;
    if (!row) return undefined;
    return {
      healthy: row.healthy === 1,
      latencyMs: row.latencyMs !== null ? row.latencyMs : undefined,
      rateLimited: row.rateLimited === 1,
      cooldownUntil: row.cooldownUntil ? new Date(row.cooldownUntil) : undefined,
      score: row.score,
      lastChecked: new Date(row.lastChecked),
    };
  }

  private initializeSchema(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        state TEXT NOT NULL,
        prompts_sent INTEGER DEFAULT 0,
        token_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS session_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        system_prompt TEXT,
        files TEXT,
        working_directory TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost REAL NOT NULL,
        timestamp TIMESTAMP NOT NULL
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS routing_metadata (
        session_id TEXT PRIMARY KEY,
        decision TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS provider_health (
        provider_id TEXT PRIMARY KEY,
        healthy INTEGER NOT NULL,
        latency_ms INTEGER,
        rate_limited INTEGER NOT NULL,
        cooldown_until TEXT,
        score INTEGER NOT NULL,
        last_checked TEXT NOT NULL
      )
    `).run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_prompts_session ON session_prompts(session_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_tokens_session ON token_usage(session_id)').run();
  }
}
