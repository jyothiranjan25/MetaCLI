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
import { ProviderRuntimeManager } from './runtime/ProviderRuntimeManager.js';
import { ProviderSession } from './runtime/ProviderSession.js';

export interface FallbackOptions {
  maxFallbacks: number;
  excludeProviders?: string[];
}

export class FallbackEngine {
  constructor(
    private router: ProviderRouter,
    private eventBus: EventBus<MetaCLIEvents>,
    private runtimeManager?: ProviderRuntimeManager,
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

      // Let the UI know which provider was selected before waiting for the response
      yield { type: 'routing_complete', provider: adapter.id, fallbacks };

      try {
        // Attempt to stream from this provider
        const startTime = Date.now();
        let hasOutput = false;
        let rateLimited = false;

        const streamSource = this.runtimeManager
          ? await this.runtimeManager.acquireSession(adapter.id)
          : adapter;

        for await (const event of streamSource.sendPrompt(request)) {
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
            const isRateLimit = this.isRateLimitError(event.error);
            const isAuth = this.isAuthError(event.error);
            const errorType = isRateLimit ? 'Rate limit' : isAuth ? 'Auth' : 'Provider';
            const reason = `${errorType} error: ${event.error}`;

            this.router.recordOutcome(adapter.id, {
              success: false,
              rateLimited: isRateLimit,
              durationMs: Date.now() - startTime,
              error: event.error,
            });

            fallbacks.push({
              from: adapter.id,
              to: '(selecting...)',
              reason,
              timestamp: new Date(),
            });

            await this.eventBus.emit('prompt:fallback', {
              promptId,
              from: adapter.id,
              to: '(selecting...)',
              reason,
            });

            excluded.add(adapter.id);
            break;
          }

          // Yield successful events
          hasOutput = true;
          yield { ...event, provider: adapter.id, fallbacks };

          if (event.type === 'done') {
            // Record token usage if persistent session
            if (this.runtimeManager && streamSource instanceof ProviderSession) {
              const inputTokens = Math.ceil((request.prompt.length + (request.systemPrompt?.length ?? 0)) / 4);
              const outputTokens = streamSource.getTokenCount();
              this.runtimeManager.recordTokenUsage(
                adapter.id,
                streamSource.id,
                request.workingDirectory,
                promptId,
                inputTokens,
                outputTokens
              );
              this.runtimeManager.recordPrompt(
                streamSource.id,
                request.prompt,
                request.systemPrompt,
                request.files,
                request.workingDirectory
              );
              this.runtimeManager.releaseSession(streamSource);
            }

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
          // Record token usage if persistent session
          if (this.runtimeManager && streamSource instanceof ProviderSession) {
            const inputTokens = Math.ceil((request.prompt.length + (request.systemPrompt?.length ?? 0)) / 4);
            const outputTokens = streamSource.getTokenCount();
            this.runtimeManager.recordTokenUsage(
              adapter.id,
              streamSource.id,
              request.workingDirectory,
              promptId,
              inputTokens,
              outputTokens
            );
            this.runtimeManager.recordPrompt(
              streamSource.id,
              request.prompt,
              request.systemPrompt,
              request.files,
              request.workingDirectory
            );
            this.runtimeManager.releaseSession(streamSource);
          }

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

  private isRateLimitError(errorMessage: string): boolean {
    const rateLimitPatterns = [
      '429',
      'rate limit',
      'quota',
      'limit exceeded',
      'too many requests',
      'session limit',
    ];

    const lower = errorMessage.toLowerCase();
    return rateLimitPatterns.some((pattern) => lower.includes(pattern));
  }
}
