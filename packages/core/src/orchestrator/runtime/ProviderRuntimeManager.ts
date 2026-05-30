/**
 * MetaCLI Core — Provider Runtime Manager
 *
 * Supervisor managing the lifecycle of sessions, transports, and adapters.
 * Orchestrates pooling, health checks, persistence, and token accounting.
 */

import { ProviderPool } from './ProviderPool.js';
import { SessionPersistenceEngine } from './SessionPersistenceEngine.js';
import { TokenAccountingEngine } from './TokenAccountingEngine.js';
import { ClaudeTransport } from '../transports/ClaudeTransport.js';
import { GeminiTransport } from '../transports/GeminiTransport.js';
import { CodexTransport } from '../transports/CodexTransport.js';
import { OpenCodeTransport } from '../transports/OpenCodeTransport.js';
import type { ProviderTransport, TransportMode } from '../transports/ProviderTransport.js';
import { ProviderSession } from './ProviderSession.js';
import { EventBus } from '../../events/EventBus.js';
import type { MetaCLIEvents } from '../../events/events.js';
import type { HealthStatus } from '../../events/types.js';

export class ProviderRuntimeManager {
  private pool = new ProviderPool();
  private persistence = new SessionPersistenceEngine();
  private tokenEngine = new TokenAccountingEngine();

  constructor(
    private eventBus: EventBus<MetaCLIEvents>,
    private transportMode: TransportMode = 'hybrid'
  ) {
    this.restoreTokenHistory();
  }

  /**
   * Restore token records and session history from database.
   */
  private restoreTokenHistory(): void {
    try {
      const records = this.persistence.loadTokenUsages();
      this.tokenEngine.loadRecords(records);
    } catch {
      // Graceful fallback if SQLite persistence fails initially
    }
  }

  public getPool(): ProviderPool {
    return this.pool;
  }

  public getPersistenceEngine(): SessionPersistenceEngine {
    return this.persistence;
  }

  public getTokenEngine(): TokenAccountingEngine {
    return this.tokenEngine;
  }

  /**
   * Acquire an active session for the given provider.
   */
  public async acquireSession(providerId: string): Promise<ProviderSession> {
    const transportFactory = () => this.createTransport(providerId);
    const session = await this.pool.acquireSession(providerId, transportFactory);

    // Save session metadata
    this.persistence.saveSession(
      session.id,
      session.providerId,
      session.getState(),
      session.getPromptsSent(),
      session.getTokenCount()
    );

    await this.eventBus.emit('session:start', {
      sessionId: session.id,
      projectPath: process.cwd(),
    });

    return session;
  }

  /**
   * Release session and update sqlite state.
   */
  public releaseSession(session: ProviderSession): void {
    this.pool.releaseSession(session);
    this.persistence.saveSession(
      session.id,
      session.providerId,
      session.getState(),
      session.getPromptsSent(),
      session.getTokenCount()
    );
  }

  /**
   * Performs standard health diagnostic checking.
   */
  public async runHealthCheck(providerId: string): Promise<HealthStatus> {
    const transport = this.createTransport(providerId);
    const start = Date.now();
    let healthy = false;

    try {
      await transport.connect();
      healthy = transport.isConnected();
      await transport.disconnect();
    } catch {
      healthy = false;
    }

    const health: HealthStatus = {
      healthy,
      latencyMs: Date.now() - start,
      rateLimited: false,
      score: healthy ? 100 : 0,
      lastChecked: new Date(),
    };

    this.persistence.saveProviderHealth(providerId, health);
    return health;
  }

  /**
   * Trigger immediate reconnection of an existing session's transport.
   */
  public async reconnectSession(sessionId: string): Promise<void> {
    const transport = this.pool.getTransport(sessionId);
    if (transport) {
      await transport.disconnect();
      await transport.connect();
    }
  }

  /**
   * Log prompt to offline SQLite database.
   */
  public recordPrompt(
    sessionId: string,
    prompt: string,
    systemPrompt?: string,
    files?: string[],
    workingDirectory?: string
  ): void {
    this.persistence.recordPrompt(
      sessionId,
      prompt,
      systemPrompt,
      files,
      workingDirectory
    );
  }

  /**
   * Record per-token transactions dynamically and sync to persistence engine.
   */
  public recordTokenUsage(
    providerId: string,
    sessionId: string,
    projectPath: string,
    workflowId: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const record = this.tokenEngine.recordUsage(
      providerId,
      sessionId,
      projectPath,
      workflowId,
      inputTokens,
      outputTokens
    );
    this.persistence.saveTokenUsage(record);
  }

  /**
   * Shutdown manager and close all pools/connections.
   */
  public async shutdown(): Promise<void> {
    await this.pool.closeAll();
    this.persistence.close();
  }

  /**
   * Factory for creating provider transports.
   */
  private createTransport(providerId: string): ProviderTransport {
    switch (providerId) {
      case 'claude-code':
        return new ClaudeTransport(this.transportMode);
      case 'gemini-cli':
        return new GeminiTransport(this.transportMode);
      case 'codex-cli':
        return new CodexTransport(this.transportMode);
      case 'opencode-cli':
        return new OpenCodeTransport(this.transportMode);
      default:
        throw new Error(`Unsupported provider ID: ${providerId}`);
    }
  }
}
