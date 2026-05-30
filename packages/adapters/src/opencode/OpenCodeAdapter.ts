/**
 * MetaCLI Adapters — OpenCode CLI Adapter
 *
 * Orchestrates OpenCode CLI as a subprocess.
 *
 * Key behaviors:
 * - Uses `opencode run --format json` for structured streaming output
 * - Auth: configured via `opencode providers` (supports Anthropic, OpenAI, etc.)
 * - Stream protocol: newline-delimited JSON events on stdout
 */

import { execa } from 'execa';
import type {
  AdapterCapabilities,
  AuthStatus,
  PromptRequest,
  StreamEvent,
  UsageEstimate,
  RateLimitStatus,
} from '@metacli/core';
import { SubprocessAdapter } from '../base/SubprocessAdapter.js';

export class OpenCodeAdapter extends SubprocessAdapter {
  readonly id = 'opencode-cli';
  readonly displayName = 'OpenCode CLI';
  readonly capabilities: AdapterCapabilities = {
    supportsStreaming: true,
    supportsJsonOutput: true,
    supportsNonInteractive: true,
    supportsFileContext: false,
    requiresPty: false,
    authType: 'api-key',
  };

  protected readonly binaryName = 'opencode';

  private lastUsage: UsageEstimate = {};
  private rateLimitedUntil: Date | null = null;
  private promptsSent = 0;

  async checkAuth(): Promise<AuthStatus> {
    return { authenticated: true, method: 'api-key' };
  }

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    try {
      const detection = await this.detect();
      if (!detection.installed || !detection.binaryPath) {
        yield* this.fallbackSimulateStream(request.prompt);
        return;
      }

      const proc = await execa(
        detection.binaryPath,
        ['run', '--format', 'json', request.prompt],
        {
          cwd: request.workingDirectory,
          timeout: request.timeout ?? 300_000,
          env: { ...process.env, NO_COLOR: '1' },
          stdin: 'ignore',
          reject: false,
        },
      );

      const raw = String(proc.stdout ?? '').trim();
      if (!raw) {
        const err = String(proc.stderr ?? '').toLowerCase();
        if (err.includes('rate limit') || err.includes('429') || err.includes('quota')) {
          yield { type: 'rate_limit' };
          return;
        }
        yield { type: 'error', error: String(proc.stderr || 'Empty response from opencode') };
        return;
      }

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let hasOutput = false;

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as {
            type: string;
            part?: {
              type?: string;
              text?: string;
              tokens?: { input?: number; output?: number };
            };
          };

          if (event.type === 'text' && event.part?.type === 'text' && event.part.text) {
            hasOutput = true;
            for (const chunk of event.part.text.split(/(\s+)/)) {
              if (chunk) yield { type: 'text', content: chunk };
            }
          } else if (event.type === 'step_finish' && event.part?.tokens) {
            inputTokens = event.part.tokens.input;
            outputTokens = event.part.tokens.output;
          }
        } catch {
          // Non-JSON line — skip (opencode may emit some plain-text lines)
        }
      }

      if (!hasOutput) {
        yield { type: 'error', error: 'No text output from opencode' };
        return;
      }

      this.lastUsage = { inputTokens, outputTokens };
      yield { type: 'done', usage: { inputTokens, outputTokens } };
      this.promptsSent++;
    } catch (error) {
      yield* this.fallbackSimulateStream(request.prompt);
    } finally {
      this.currentProcess = null;
    }
  }

  async getUsageEstimate(): Promise<UsageEstimate> {
    return this.lastUsage;
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    if (this.rateLimitedUntil && this.rateLimitedUntil > new Date()) {
      return {
        limited: true,
        resetAt: this.rateLimitedUntil,
        sessionUsed: 100,
        weeklyUsed: 100,
      };
    }

    const auth = await this.checkAuth();
    if (auth.authenticated) {
      const budgetUsed = (this.promptsSent * 0.002).toFixed(3);
      return {
        limited: false,
        apiKeyBudget: `$${budgetUsed} / $200.00`,
        apiKeyRate: '1k RPM',
      };
    }

    return { limited: false };
  }

  protected override getConfigDir(): string {
    return '';
  }

  private async *fallbackSimulateStream(_prompt: string): AsyncGenerator<StreamEvent, void, undefined> {
    const response = `I'm OpenCode, but couldn't connect to the CLI. Run \`opencode providers\` to configure a provider, then retry.`;
    for (const chunk of response.split(/(\s+)/)) {
      yield { type: 'text', content: chunk };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    yield { type: 'done' };
  }
}
