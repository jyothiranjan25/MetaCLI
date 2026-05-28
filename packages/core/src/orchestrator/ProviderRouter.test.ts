import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRouter, AllProvidersExhaustedError } from './ProviderRouter.js';
import { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import type { AIAdapter } from './adapter-types.js';

describe('ProviderRouter', () => {
  let eventBus: EventBus<MetaCLIEvents>;
  let router: ProviderRouter;

  const mockClaude: AIAdapter = {
    id: 'claude-code',
    displayName: 'Claude Code',
    capabilities: {
      supportsStreaming: true,
      supportsJsonOutput: true,
      supportsNonInteractive: true,
      supportsFileContext: true,
      requiresPty: false,
      authType: 'oauth',
    },
    detect: async () => ({ installed: true }),
    checkAuth: async () => ({ authenticated: true }),
    checkHealth: async () => ({ healthy: true, latencyMs: 100, rateLimited: false, score: 100 }),
    sendPrompt: async function* () {},
    abort: async () => {},
    getUsageEstimate: async () => ({}),
    getRateLimitStatus: async () => ({ rateLimited: false }),
  };

  const mockGemini: AIAdapter = {
    id: 'gemini-cli',
    displayName: 'Gemini CLI',
    capabilities: {
      supportsStreaming: true,
      supportsJsonOutput: true,
      supportsNonInteractive: true,
      supportsFileContext: true,
      requiresPty: false,
      authType: 'oauth',
    },
    detect: async () => ({ installed: true }),
    checkAuth: async () => ({ authenticated: true }),
    checkHealth: async () => ({ healthy: true, latencyMs: 50, rateLimited: false, score: 100 }),
    sendPrompt: async function* () {},
    abort: async () => {},
    getUsageEstimate: async () => ({}),
    getRateLimitStatus: async () => ({ rateLimited: false }),
  };

  beforeEach(() => {
    eventBus = new EventBus<MetaCLIEvents>();
    router = new ProviderRouter(
      {
        preferredProvider: 'claude-code',
        fallbackOrder: ['claude-code', 'gemini-cli'],
        healthScoreThreshold: 30,
        cooldownDuration: 300000, // 5 mins
      },
      eventBus,
    );
  });

  it('should allow registering and getting adapters', () => {
    router.registerAdapter(mockClaude);
    router.registerAdapter(mockGemini);

    expect(router.getAdapter('claude-code')).toBe(mockClaude);
    expect(router.getAdapter('gemini-cli')).toBe(mockGemini);
    expect(router.getAllAdapters()).toContain(mockClaude);
    expect(router.getAllAdapters()).toContain(mockGemini);
  });

  it('should route to the preferred provider if healthy', async () => {
    router.registerAdapter(mockClaude);
    router.registerAdapter(mockGemini);

    const decision = await router.selectProvider({ prompt: 'hello' });

    expect(decision.adapterId).toBe('claude-code');
  });

  it('should respect request-specific preferred provider', async () => {
    router.registerAdapter(mockClaude);
    router.registerAdapter(mockGemini);

    const decision = await router.selectProvider({
      prompt: 'hello',
      preferredProvider: 'gemini-cli',
    });

    expect(decision.adapterId).toBe('gemini-cli');
  });

  it('should exclude explicitly requested providers', async () => {
    router.registerAdapter(mockClaude);
    router.registerAdapter(mockGemini);

    const decision = await router.selectProvider({
      prompt: 'hello',
      excludeProviders: ['claude-code'],
    });

    expect(decision.adapterId).toBe('gemini-cli');
  });

  it('should update health score on successful outcome', () => {
    router.registerAdapter(mockClaude);
    
    // Initial health score is 100
    router.recordOutcome('claude-code', { success: true, rateLimited: false, durationMs: 100 });
    const summary = router.getHealthSummary().get('claude-code');
    expect(summary?.score).toBe(100);
  });

  it('should lower health score on failure and transition to unhealthy if below threshold', () => {
    const unhealthyListener = vi.fn();
    eventBus.on('provider:unhealthy', unhealthyListener);

    router.registerAdapter(mockClaude);
    
    // Multiple failures will drop the score below 30
    router.recordOutcome('claude-code', { success: false, rateLimited: false, durationMs: 100 });
    router.recordOutcome('claude-code', { success: false, rateLimited: false, durationMs: 100 });
    router.recordOutcome('claude-code', { success: false, rateLimited: false, durationMs: 100 });
    router.recordOutcome('claude-code', { success: false, rateLimited: false, durationMs: 100 });

    const summary = router.getHealthSummary().get('claude-code');
    expect(summary!.score).toBeLessThan(30);
    expect(unhealthyListener).toHaveBeenCalled();
  });

  it('should trigger cooldown on rate limits', async () => {
    const rateLimitedListener = vi.fn();
    const cooldownListener = vi.fn();
    eventBus.on('provider:rate_limited', rateLimitedListener);
    eventBus.on('provider:cooldown_start', cooldownListener);

    router.registerAdapter(mockClaude);
    router.registerAdapter(mockGemini);

    // Claude is rate limited
    router.recordOutcome('claude-code', { success: false, rateLimited: true, durationMs: 50 });

    expect(rateLimitedListener).toHaveBeenCalled();
    expect(cooldownListener).toHaveBeenCalled();

    // Provider router should now route to Gemini instead of Claude (since Claude is in cooldown)
    const decision = await router.selectProvider({ prompt: 'test' });
    expect(decision.adapterId).toBe('gemini-cli');
  });

  it('should throw AllProvidersExhaustedError if no candidates are available', async () => {
    router.registerAdapter(mockClaude);
    
    // Claude in cooldown
    router.recordOutcome('claude-code', { success: false, rateLimited: true, durationMs: 50 });

    await expect(router.selectProvider({ prompt: 'test' })).rejects.toThrow(
      AllProvidersExhaustedError,
    );
  });
});
