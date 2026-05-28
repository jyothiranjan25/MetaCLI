/**
 * MetaCLI Core — Fallback Engine
 *
 * Manages automatic provider fallback when a prompt fails due to
 * rate limits, auth errors, or provider unavailability.
 *
 * Flow: attempt provider → detect failure → select fallback → retry
 */

import type { PromptRequest, StreamEvent, FallbackRecord } from '../events/types.js';
import { ProviderRouter } from './ProviderRouter.js';
import { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface FallbackOptions {
  maxFallbacks: number;
  excludeProviders?: string[];
}

export class FallbackEngine {
  constructor(
    private router: ProviderRouter,
    private eventBus: EventBus<MetaCLIEvents>,
  ) {}

  /**
   * Execute a prompt with automatic fallback on failure.
   * Yields stream events from whichever provider succeeds.
   */
  async *executeWithFallback(
    promptId: string,
    request: PromptRequest,
    preferredProvider?: string,
    options: FallbackOptions = { maxFallbacks: 3 },
  ): AsyncGenerator<StreamEvent & { provider: string; fallbacks: FallbackRecord[] }, void, undefined> {
    const excluded = new Set<string>(options.excludeProviders ?? []);
    const fallbacks: FallbackRecord[] = [];
    let attempts = 0;

    while (attempts <= options.maxFallbacks) {
      // Select a provider
      const decision = await this.router.selectProvider({
        prompt: request.prompt,
        preferredProvider: attempts === 0 ? preferredProvider : undefined,
        excludeProviders: Array.from(excluded),
      });

      const adapter = this.router.getAdapter(decision.adapterId);
      if (!adapter) {
        excluded.add(decision.adapterId);
        attempts++;
        continue;
      }

      await this.eventBus.emit('prompt:start', {
        promptId,
        provider: adapter.id,
        prompt: request.prompt,
      });

      try {
        // Attempt to stream from this provider
        const startTime = Date.now();
        let hasOutput = false;
        let rateLimited = false;

        for await (const event of adapter.sendPrompt(request)) {
          // Check for rate limit events
          if (event.type === 'rate_limit') {
            rateLimited = true;

            // Record rate limit
            this.router.recordOutcome(adapter.id, {
              success: false,
              rateLimited: true,
              retryAfter: event.retryAfter
                ? new Date(Date.now() + event.retryAfter * 1000)
                : undefined,
              durationMs: Date.now() - startTime,
            });

            // Fallback to next provider
            fallbacks.push({
              from: adapter.id,
              to: '(selecting...)',
              reason: 'Rate limited',
              timestamp: new Date(),
            });

            await this.eventBus.emit('prompt:fallback', {
              promptId,
              from: adapter.id,
              to: '(selecting...)',
              reason: 'Rate limited',
            });

            excluded.add(adapter.id);
            break;
          }

          // Check for error events
          if (event.type === 'error') {
            const isAuthError = this.isAuthError(event.error);

            this.router.recordOutcome(adapter.id, {
              success: false,
              rateLimited: false,
              durationMs: Date.now() - startTime,
              error: event.error,
            });

            if (isAuthError) {
              fallbacks.push({
                from: adapter.id,
                to: '(selecting...)',
                reason: `Auth error: ${event.error}`,
                timestamp: new Date(),
              });

              await this.eventBus.emit('prompt:fallback', {
                promptId,
                from: adapter.id,
                to: '(selecting...)',
                reason: `Auth error: ${event.error}`,
              });

              excluded.add(adapter.id);
              break;
            }

            // Non-recoverable error — yield it and stop
            yield { ...event, provider: adapter.id, fallbacks };
            return;
          }

          // Yield successful events
          hasOutput = true;
          yield { ...event, provider: adapter.id, fallbacks };

          if (event.type === 'done') {
            // Success — record good outcome
            this.router.recordOutcome(adapter.id, {
              success: true,
              rateLimited: false,
              durationMs: Date.now() - startTime,
            });
            return;
          }
        }

        // If we got here without hitting rate_limit/error, the stream ended normally
        if (hasOutput && !rateLimited) {
          this.router.recordOutcome(adapter.id, {
            success: true,
            rateLimited: false,
            durationMs: Date.now() - startTime,
          });
          return;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        this.router.recordOutcome(adapter.id, {
          success: false,
          rateLimited: false,
          durationMs: 0,
          error: errorMsg,
        });

        fallbacks.push({
          from: adapter.id,
          to: '(selecting...)',
          reason: errorMsg,
          timestamp: new Date(),
        });

        await this.eventBus.emit('prompt:fallback', {
          promptId,
          from: adapter.id,
          to: '(selecting...)',
          reason: errorMsg,
        });

        excluded.add(adapter.id);
      }

      attempts++;
    }

    // All fallbacks exhausted
    yield {
      type: 'error',
      error: `All providers exhausted after ${attempts} attempts. Fallback history: ${JSON.stringify(fallbacks)}`,
      provider: 'none',
      fallbacks,
    };
  }

  private isAuthError(errorMessage: string): boolean {
    const authPatterns = [
      'auth',
      'unauthorized',
      'unauthenticated',
      'login',
      'credential',
      'token expired',
      'session expired',
      'permission denied',
      '401',
      '403',
    ];

    const lower = errorMessage.toLowerCase();
    return authPatterns.some((pattern) => lower.includes(pattern));
  }
}
