/**
 * MetaCLI Core — Session Router
 *
 * Extends the ProviderRouter to support routing prompts to active/warm sessions.
 * Reuses existing provider processes when available.
 */

import { ProviderRouter } from '../ProviderRouter.js';
import type { ProviderPool } from './ProviderPool.js';
import type { ProviderSession } from './ProviderSession.js';
import type { RoutingRequest, RoutingDecision } from '../../events/types.js';
import { EventBus } from '../../events/EventBus.js';
import type { MetaCLIEvents } from '../../events/events.js';
import type { RoutingConfig } from '../../config/schema.js';

export class SessionRouter extends ProviderRouter {
  constructor(
    config: RoutingConfig,
    eventBus: EventBus<MetaCLIEvents>,
    private pool: ProviderPool
  ) {
    super(config, eventBus);
  }

  /**
   * Selects an active warm session or falls back to selecting a provider and acquiring a session.
   */
  public async routeToSession(
    request: RoutingRequest,
    acquireSessionFn: (providerId: string) => Promise<ProviderSession>
  ): Promise<{ session: ProviderSession; decision: RoutingDecision }> {
    // 1. Check if there is an active session for the preferred provider that is already warm
    if (request.preferredProvider) {
      const warmSessions = this.pool.getWarmSessions();
      const existing = warmSessions.find((s) => s.providerId === request.preferredProvider);
      if (existing) {
        const decision: RoutingDecision = {
          adapterId: request.preferredProvider,
          reason: 'Routed to existing warm session',
          score: 100,
          alternatives: [],
        };
        return { session: existing, decision };
      }
    }

    // 2. Select provider using base class logic
    const decision = await this.selectProvider(request);

    // 3. Check if we have a warm session for the selected provider
    const warmSessions = this.pool.getWarmSessions();
    const existing = warmSessions.find((s) => s.providerId === decision.adapterId);

    if (existing) {
      return { session: existing, decision };
    }

    // 4. Fallback to acquiring a new/idle session
    const session = await acquireSessionFn(decision.adapterId);
    return { session, decision };
  }
}
