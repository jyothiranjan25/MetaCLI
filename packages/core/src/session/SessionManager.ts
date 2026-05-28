/**
 * MetaCLI Core — Session Manager
 *
 * Tracks the lifecycle of interactive sessions: start, prompts, end.
 * Records session data for future memory/compaction use (Phase 2+).
 */

import { randomUUID } from 'node:crypto';
import type { SessionRecord, PromptRecord } from '../events/types.js';
import { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export class SessionManager {
  private currentSession: SessionRecord | null = null;

  constructor(private eventBus: EventBus<MetaCLIEvents>) {}

  /**
   * Start a new session.
   */
  async startSession(projectPath: string): Promise<string> {
    const sessionId = randomUUID();

    this.currentSession = {
      id: sessionId,
      projectPath,
      startedAt: new Date(),
      prompts: [],
      touchedFiles: [],
      decisions: [],
    };

    await this.eventBus.emit('session:start', {
      sessionId,
      projectPath,
    });

    return sessionId;
  }

  /**
   * Record a prompt within the current session.
   */
  recordPrompt(record: PromptRecord): void {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    this.currentSession.prompts.push(record);
  }

  /**
   * Record files that were touched during the session.
   */
  recordTouchedFiles(files: string[]): void {
    if (!this.currentSession) return;

    for (const file of files) {
      if (!this.currentSession.touchedFiles.includes(file)) {
        this.currentSession.touchedFiles.push(file);
      }
    }
  }

  /**
   * Record architectural decisions made during the session.
   */
  recordDecision(decision: string): void {
    if (!this.currentSession) return;
    this.currentSession.decisions.push(decision);
  }

  /**
   * End the current session and return the record.
   */
  async endSession(): Promise<SessionRecord | null> {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date();
    const session = { ...this.currentSession };

    const durationMs =
      this.currentSession.endedAt.getTime() - this.currentSession.startedAt.getTime();

    await this.eventBus.emit('session:end', {
      sessionId: session.id,
      promptCount: session.prompts.length,
      durationMs,
    });

    this.currentSession = null;
    return session;
  }

  /**
   * Get the current active session.
   */
  getCurrentSession(): SessionRecord | null {
    return this.currentSession;
  }
}
