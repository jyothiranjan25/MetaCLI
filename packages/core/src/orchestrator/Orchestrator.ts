/**
 * MetaCLI Core — Orchestrator
 *
 * The main coordination loop. This is what the CLI interacts with.
 * It ties together: config → brain → router → fallback → streaming → memory.
 */

import { randomUUID } from 'node:crypto';
import type { AIAdapter } from './adapter-types.js';
import { ProviderRouter } from './ProviderRouter.js';
import { FallbackEngine } from './FallbackEngine.js';
import { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import type {
  PromptRequest,
  PromptResult,
  StreamEvent,
  FallbackRecord,
} from '../events/types.js';
import type { MetaCLIConfig } from '../config/schema.js';

export class Orchestrator {
  private router: ProviderRouter;
  private fallbackEngine: FallbackEngine;
  private eventBus: EventBus<MetaCLIEvents>;
  private currentPromptId: string | null = null;

  constructor(
    private config: MetaCLIConfig,
    eventBus?: EventBus<MetaCLIEvents>,
  ) {
    this.eventBus = eventBus ?? new EventBus<MetaCLIEvents>();
    this.router = new ProviderRouter(config.routing, this.eventBus);
    this.fallbackEngine = new FallbackEngine(this.router, this.eventBus);
  }

  /**
   * Get the event bus for subscribing to system events.
   */
  getEventBus(): EventBus<MetaCLIEvents> {
    return this.eventBus;
  }

  /**
   * Get the provider router for health/status queries.
   */
  getRouter(): ProviderRouter {
    return this.router;
  }

  /**
   * Register a provider adapter with the orchestrator.
   */
  registerAdapter(adapter: AIAdapter): void {
    this.router.registerAdapter(adapter);
  }

  /**
   * Detect and register all available providers.
   * Checks which CLIs are installed and authenticated.
   */
  async detectProviders(): Promise<Map<string, { installed: boolean; authenticated: boolean }>> {
    const results = new Map<string, { installed: boolean; authenticated: boolean }>();

    for (const adapter of this.router.getAllAdapters()) {
      try {
        const detection = await adapter.detect();

        if (detection.installed) {
          await this.eventBus.emit('provider:detected', {
            adapterId: adapter.id,
            version: detection.version ?? 'unknown',
            binaryPath: detection.binaryPath ?? 'unknown',
          });

          const auth = await adapter.checkAuth();
          if (auth.authenticated) {
            await this.eventBus.emit('provider:auth_valid', {
              adapterId: adapter.id,
              method: auth.method ?? 'unknown',
            });
          }

          results.set(adapter.id, {
            installed: true,
            authenticated: auth.authenticated,
          });
        } else {
          results.set(adapter.id, { installed: false, authenticated: false });
        }
      } catch {
        results.set(adapter.id, { installed: false, authenticated: false });
      }
    }

    return results;
  }

  /**
   * Send a prompt with full orchestration:
   * 1. (Future: Retrieve context from brain)
   * 2. Route to best provider
   * 3. Stream response with automatic fallback
   * 4. (Future: Record session and update memory)
   *
   * Returns an async generator for streaming consumption by the UI.
   */
  async *ask(
    prompt: string,
    options: AskOptions = {},
  ): AsyncGenerator<OrchestratedStreamEvent, PromptResult, undefined> {
    const promptId = randomUUID();
    this.currentPromptId = promptId;

    let systemPrompt = options.systemPrompt;
    if (options.contextResolver) {
      try {
        const context = await options.contextResolver(prompt);
        if (context) {
          systemPrompt = systemPrompt ? `${context}\n\n${systemPrompt}` : context;
        }
      } catch {
        // Safe fallback
      }
    }

    const request: PromptRequest = {
      prompt,
      workingDirectory: options.workingDirectory ?? process.cwd(),
      files: options.files,
      systemPrompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeout: options.timeout,
    };

    const startTime = Date.now();
    let fullContent = '';
    let lastProvider = '';
    const allFallbacks: FallbackRecord[] = [];

    try {
      for await (const event of this.fallbackEngine.executeWithFallback(
        promptId,
        request,
        options.preferredProvider ?? this.config.routing.preferredProvider,
        { maxFallbacks: 3 },
      )) {
        lastProvider = event.provider;

        // Accumulate text content
        if (event.type === 'text') {
          fullContent += event.content;
        }

        // Track fallbacks
        if (event.fallbacks.length > allFallbacks.length) {
          allFallbacks.push(...event.fallbacks.slice(allFallbacks.length));
        }

        // Yield the stream event to the UI
        yield {
          promptId,
          provider: event.provider,
          event: event as StreamEvent,
          fallbackCount: allFallbacks.length,
        };
      }
    } finally {
      this.currentPromptId = null;
    }

    // Return the final result
    return {
      promptId,
      provider: lastProvider,
      content: fullContent,
      durationMs: Date.now() - startTime,
      fallbacks: allFallbacks,
    };
  }

  /**
   * Abort the currently running prompt.
   */
  async abort(): Promise<void> {
    if (!this.currentPromptId) return;

    // Abort all adapters (the active one will respond)
    for (const adapter of this.router.getAllAdapters()) {
      try {
        await adapter.abort();
      } catch {
        // Best effort
      }
    }

    await this.eventBus.emit('prompt:abort', {
      promptId: this.currentPromptId,
      reason: 'User requested abort',
    });

    this.currentPromptId = null;
  }
}

// ─── Supporting Types ───────────────────────────────────────────

export interface AskOptions {
  preferredProvider?: string;
  workingDirectory?: string;
  files?: string[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  contextResolver?: (prompt: string) => Promise<string | null>;
}

export interface OrchestratedStreamEvent {
  promptId: string;
  provider: string;
  event: StreamEvent;
  fallbackCount: number;
}
