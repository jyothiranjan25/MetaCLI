/**
 * MetaCLI Core — Replay Engine
 *
 * Implements deterministic prompt execution records, prompt timelines,
 * context hashes, and session snapshot replay capabilities.
 */

export interface ReplaySnapshot {
  sessionId: string;
  timestamp: string;
  prompt: string;
  contextSnapshot: any;
  providerResponses: string[];
  envVariables: Record<string, string>;
}

export class ReplayEngine {
  private eventBus: any;
  private snapshots = new Map<string, ReplaySnapshot>();

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Saves a deterministic session snapshot.
   */
  saveSnapshot(snapshot: ReplaySnapshot): void {
    this.snapshots.set(snapshot.sessionId, snapshot);

    if (this.eventBus) {
      this.eventBus.emit('session.replayed', {
        sessionId: snapshot.sessionId,
      });
    }
  }

  /**
   * Loads a session snapshot for debugging or dry-running.
   */
  loadSnapshot(sessionId: string): ReplaySnapshot | undefined {
    return this.snapshots.get(sessionId);
  }
}
