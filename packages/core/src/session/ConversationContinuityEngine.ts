/**
 * MetaCLI Core — Conversational Continuity Engine
 *
 * Persists session timeline boundaries, workflow checkpoints, and chronological
 * epochs to restore logical context streams across CLI restarts.
 *
 * Uses SessionPersistenceEngine as the durable backing store so continuity
 * survives full process restarts.
 */

import { SessionPersistenceEngine } from '../orchestrator/runtime/SessionPersistenceEngine.js';
import { randomUUID } from 'node:crypto';

export interface SessionContinuity {
  activeSessionId: string;
  lastKnownFiles: string[];
  activeWorkflowId?: string;
  hasRollbackPending: boolean;
  timestamp: number;
  lastPrompt?: string;
}

export class ConversationContinuityEngine {
  private eventBus: any;
  private currentContinuity: SessionContinuity | null = null;
  private persistence: SessionPersistenceEngine | null = null;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
    try {
      this.persistence = new SessionPersistenceEngine();
    } catch {
      // Graceful fallback if SQLite unavailable (e.g. headless test env)
    }
  }

  /**
   * Stitches past active boundaries and snapshots back into the model's memory loop.
   * Returns the most recent session continuity, or creates a new one.
   */
  async restoreContinuity(workspacePath: string): Promise<SessionContinuity> {
    let restoredSessionId: string | undefined;
    let lastPrompt: string | undefined;

    if (this.persistence) {
      try {
        const sessions = this.persistence.getAllSessions();
        const workspaceSessions = sessions.filter((s) => {
          const history = this.persistence!.getSessionHistory(s.id);
          return history.some((h) => h.workingDirectory === workspacePath);
        });

        if (workspaceSessions.length > 0) {
          const mostRecent = workspaceSessions[0];
          restoredSessionId = mostRecent.id;
          const history = this.persistence.getSessionHistory(mostRecent.id);
          if (history.length > 0) {
            lastPrompt = history[history.length - 1].prompt;
          }
        }
      } catch { /* non-fatal */ }
    }

    const sessionId = restoredSessionId ?? randomUUID();

    const continuity: SessionContinuity = {
      activeSessionId: sessionId,
      lastKnownFiles: [],
      hasRollbackPending: false,
      timestamp: Date.now(),
      lastPrompt,
    };

    this.currentContinuity = continuity;

    if (this.persistence && !restoredSessionId) {
      try {
        this.persistence.saveSession(sessionId, 'auto', 'active', 0, 0);
      } catch { /* non-fatal */ }
    }

    if (this.eventBus) {
      this.eventBus.emit('continuity.restored', {
        sessionId: continuity.activeSessionId,
        timestamp: continuity.timestamp,
        workspacePath,
        restored: !!restoredSessionId,
      });
    }

    return continuity;
  }

  /**
   * Tracks and checkpoints active workflow progress state.
   */
  async checkpointState(files: string[], activeWorkflowId?: string): Promise<void> {
    if (this.currentContinuity) {
      this.currentContinuity.lastKnownFiles = files;
      this.currentContinuity.activeWorkflowId = activeWorkflowId;
      this.currentContinuity.timestamp = Date.now();

      if (this.persistence) {
        try {
          this.persistence.saveSession(
            this.currentContinuity.activeSessionId,
            'auto',
            'active',
            files.length,
            0,
          );
        } catch { /* non-fatal */ }
      }
    }
  }

  /**
   * Record a prompt within the active session for cross-session continuity.
   */
  recordPrompt(prompt: string, workingDirectory: string, files?: string[]): void {
    if (!this.currentContinuity || !this.persistence) return;
    try {
      this.persistence.recordPrompt(
        this.currentContinuity.activeSessionId,
        prompt,
        undefined,
        files,
        workingDirectory,
      );
    } catch { /* non-fatal */ }
  }

  /**
   * Gets the active continuity status.
   */
  getContinuity(): SessionContinuity | null {
    return this.currentContinuity;
  }

  /**
   * Closes the backing store — call when the process exits.
   */
  close(): void {
    try {
      this.persistence?.close();
    } catch { /* non-fatal */ }
  }
}
