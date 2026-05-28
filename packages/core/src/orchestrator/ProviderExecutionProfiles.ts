/**
 * MetaCLI Core — Provider Execution Profiles
 *
 * Deep behavioral profiling for every AI provider. Drives dynamic
 * prompt adaptation, context window sizing, retry strategies, and
 * workflow role assignment. Adjusts dynamically via telemetry.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface ProviderProfile {
  id: string;
  name: string;
  strengths: Array<'architecture' | 'implementation' | 'debugging' | 'speed' | 'refactor' | 'testing'>;
  contextTolerance: 'low' | 'medium' | 'high' | 'massive';
  latencyBehavior: 'consistent' | 'variable' | 'bursty';
  promptSensitivity: number; // 0–1
  preferredFormat: 'markdown' | 'json' | 'code-only';
  maxContextTokens: number;
  optimalContextTokens: number;
  retryBehavior: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  workflowRoles: Array<'architect' | 'implementer' | 'reviewer' | 'tester'>;
}

export interface ProviderAdaptation {
  contextDepth: 'shallow' | 'medium' | 'deep';
  decompositionStrategy: 'monolithic' | 'chunked' | 'streaming';
  formatHint: string;
  tokenBudget: number;
  promptPrefix?: string;
}

export class ProviderExecutionProfiles {
  private readonly profiles = new Map<string, ProviderProfile>();
  private readonly dynamicOverrides = new Map<string, Partial<ProviderProfile>>();

  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {
    this.initBaseProfiles();
    if (this.__eventBus) this.bindTelemetry();
  }

  private initBaseProfiles(): void {
    const base: ProviderProfile[] = [
      {
        id: 'claude',
        name: 'Claude (Anthropic)',
        strengths: ['architecture', 'refactor', 'debugging'],
        contextTolerance: 'massive',
        latencyBehavior: 'consistent',
        promptSensitivity: 0.9,
        preferredFormat: 'markdown',
        maxContextTokens: 200_000,
        optimalContextTokens: 80_000,
        retryBehavior: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
        workflowRoles: ['architect', 'reviewer'],
      },
      {
        id: 'gemini',
        name: 'Gemini (Google)',
        strengths: ['speed', 'implementation', 'testing'],
        contextTolerance: 'massive',
        latencyBehavior: 'variable',
        promptSensitivity: 0.7,
        preferredFormat: 'json',
        maxContextTokens: 1_000_000,
        optimalContextTokens: 100_000,
        retryBehavior: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 1.5 },
        workflowRoles: ['implementer', 'tester'],
      },
      {
        id: 'codex',
        name: 'OpenAI Codex',
        strengths: ['implementation', 'speed'],
        contextTolerance: 'medium',
        latencyBehavior: 'consistent',
        promptSensitivity: 0.8,
        preferredFormat: 'code-only',
        maxContextTokens: 8_000,
        optimalContextTokens: 4_000,
        retryBehavior: { maxRetries: 3, backoffMs: 800, backoffMultiplier: 2 },
        workflowRoles: ['implementer'],
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        strengths: ['implementation', 'debugging', 'testing'],
        contextTolerance: 'high',
        latencyBehavior: 'consistent',
        promptSensitivity: 0.75,
        preferredFormat: 'code-only',
        maxContextTokens: 32_000,
        optimalContextTokens: 16_000,
        retryBehavior: { maxRetries: 2, backoffMs: 600, backoffMultiplier: 1.5 },
        workflowRoles: ['implementer', 'reviewer'],
      },
    ];

    for (const p of base) this.profiles.set(p.id, p);
  }

  private bindTelemetry(): void {
    this.__eventBus!.on('provider.benchmarked' as any, (data: { providerId: string; latencyMs: number; success: boolean }) => {
      this.applyTelemetry(data.providerId, data.latencyMs);
    });
  }

  private applyTelemetry(providerId: string, latencyMs: number): void {
    const profile = this.profiles.get(providerId);
    if (!profile) return;

    const override = this.dynamicOverrides.get(providerId) ?? {};

    if (latencyMs > 12_000) {
      override.latencyBehavior = 'bursty';
    } else if (latencyMs < 3_000 && override.latencyBehavior === 'bursty') {
      override.latencyBehavior = profile.latencyBehavior;
    }

    this.dynamicOverrides.set(providerId, override);
  }

  public getProfile(providerId: string): ProviderProfile | undefined {
    const base = this.profiles.get(providerId);
    if (!base) return undefined;
    const override = this.dynamicOverrides.get(providerId) ?? {};
    return { ...base, ...override };
  }

  public getAdaptationFor(providerId: string, baseTokens: number): ProviderAdaptation {
    const profile = this.getProfile(providerId);
    if (!profile) {
      return { contextDepth: 'medium', decompositionStrategy: 'chunked', formatHint: 'Use markdown.', tokenBudget: baseTokens };
    }

    const tokenBudget = Math.min(baseTokens, profile.optimalContextTokens);

    const contextDepth: ProviderAdaptation['contextDepth'] =
      profile.contextTolerance === 'massive' ? 'deep'
      : profile.contextTolerance === 'low' ? 'shallow'
      : 'medium';

    const decompositionStrategy: ProviderAdaptation['decompositionStrategy'] =
      profile.contextTolerance === 'low' ? 'chunked'
      : profile.latencyBehavior === 'consistent' ? 'streaming'
      : 'monolithic';

    const formatHint =
      profile.preferredFormat === 'json' ? 'Respond strictly in JSON format.'
      : profile.preferredFormat === 'code-only' ? 'Respond with code only. No prose.'
      : 'Use markdown with clear headings and fenced code blocks.';

    return { contextDepth, decompositionStrategy, formatHint, tokenBudget };
  }

  public getOptimalProviderForRole(role: ProviderProfile['workflowRoles'][number]): ProviderProfile | null {
    let best: ProviderProfile | null = null;
    for (const id of this.profiles.keys()) {
      const p = this.getProfile(id)!;
      if (!p.workflowRoles.includes(role)) continue;
      if (!best || p.latencyBehavior === 'consistent') best = p;
    }
    return best;
  }

  public getOptimalProviderForTask(task: ProviderProfile['strengths'][number]): ProviderProfile | null {
    let best: ProviderProfile | null = null;
    for (const id of this.profiles.keys()) {
      const p = this.getProfile(id)!;
      if (!p.strengths.includes(task)) continue;
      if (!best || p.latencyBehavior === 'consistent') best = p;
    }
    return best;
  }

  public getAllProfiles(): ProviderProfile[] {
    return [...this.profiles.keys()].map(id => this.getProfile(id)!);
  }
}
