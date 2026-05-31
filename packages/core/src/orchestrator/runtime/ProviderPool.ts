/**
 * MetaCLI Core — Provider Pool
 *
 * Manages pools of warm, active, and idle provider sessions.
 * Recycles existing connections to eliminate process spawning latency.
 */

import { ProviderSession } from './ProviderSession.js';
import type { ProviderTransport } from '../transports/ProviderTransport.js';

export class ProviderPool {
  private sessions = new Map<string, ProviderSession>();
  private transports = new Map<string, ProviderTransport>();

  constructor() {}

  /**
   * Acquire a session for the given provider.
   * Reuses warm/idle sessions if available, or creates a new one.
   */
  public async acquireSession(
    providerId: string,
    transportFactory: () => ProviderTransport
  ): Promise<ProviderSession> {
    // 1. Search for a warm, idle session (connected and not active/acquiring)
    for (const session of this.sessions.values()) {
      if (
        session.providerId === providerId &&
        (session.getState() === 'idle' || session.getState() === 'released')
      ) {
        const transport = this.transports.get(session.id);
        if (transport && transport.isConnected()) {
          session.setState('acquiring'); // Reserve immediately!
          return session;
        }
      }
    }

    // 2. Search for a disconnected session of the same provider that can be reconnected
    for (const session of this.sessions.values()) {
      if (
        session.providerId === providerId &&
        (session.getState() === 'idle' || session.getState() === 'released')
      ) {
        const transport = this.transports.get(session.id);
        if (transport) {
          await transport.connect();
          if (transport.isConnected()) {
            session.setState('acquiring'); // Reserve immediately!
            return session;
          }
        }
      }
    }

    // 3. Create a new session
    const transport = transportFactory();
    await transport.connect();

    const session = new ProviderSession(providerId, transport);
    session.setState('acquiring'); // Reserve immediately!
    this.sessions.set(session.id, session);
    this.transports.set(session.id, transport);

    return session;
  }

  /**
   * Release a session back to the pool.
   * Keeps it warm/idle for future requests.
   */
  public releaseSession(session: ProviderSession): void {
    session.setState('released'); // Mark as released/reusable
    if (!this.sessions.has(session.id)) {
      this.sessions.set(session.id, session);
    }
  }

  /**
   * Get all active sessions (currently processing a prompt).
   */
  public getActiveSessions(): ProviderSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.getState() === 'active'
    );
  }

  /**
   * Get warm sessions (connected and ready, not processing).
   */
  public getWarmSessions(): ProviderSession[] {
    return Array.from(this.sessions.values()).filter((s) => {
      if (s.getState() !== 'idle' && s.getState() !== 'released') return false;
      const transport = this.transports.get(s.id);
      return transport ? transport.isConnected() : false;
    });
  }

  /**
   * Get idle sessions (created but currently disconnected).
   */
  public getIdleSessions(): ProviderSession[] {
    return Array.from(this.sessions.values()).filter((s) => {
      if (s.getState() !== 'idle' && s.getState() !== 'released') return false;
      const transport = this.transports.get(s.id);
      return transport ? !transport.isConnected() : true;
    });
  }

  /**
   * Get transport by session ID.
   */
  public getTransport(sessionId: string): ProviderTransport | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Close a specific session and remove it from the pool.
   */
  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const transport = this.transports.get(sessionId);

    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
    }

    if (transport) {
      await transport.disconnect();
      this.transports.delete(sessionId);
    }
  }

  /**
   * Cancel all currently active connection sessions.
   */
  public async cancelActiveSessions(): Promise<void> {
    const active = this.getActiveSessions();
    await Promise.all(
      active.map(async (session) => {
        const transport = this.transports.get(session.id);
        if (transport) {
          try {
            await transport.cancel();
          } catch {
            // best effort
          }
        }
      })
    );
  }

  /**
   * Disconnect all warm/active sessions.
   */
  public async closeAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.closeSession(id)));
  }
}
