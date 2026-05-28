/**
 * MetaCLI Adapters — Gemini CLI Adapter
 *
 * Orchestrates Gemini CLI as a subprocess.
 *
 * Key behaviors:
 * - Uses `gemini -p --output-format stream-json` for non-interactive streaming
 * - Auth: Google OAuth browser login or GEMINI_API_KEY / Service Account
 * - Credentials stored in ~/.gemini/
 * - Rate limits: project-level quotas, 429 Resource Exhausted errors
 * - Stream protocol: newline-delimited JSON events on stdout
 */

import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { access, constants } from 'node:fs/promises';
import type {
  AdapterCapabilities,
  AuthStatus,
  PromptRequest,
  StreamEvent,
  UsageEstimate,
  RateLimitStatus,
} from '@metacli/core';
import { SubprocessAdapter } from '../base/SubprocessAdapter.js';

export class GeminiAdapter extends SubprocessAdapter {
  readonly id = 'gemini-cli';
  readonly displayName = 'Gemini CLI';
  readonly capabilities: AdapterCapabilities = {
    supportsStreaming: true,
    supportsJsonOutput: true,
    supportsNonInteractive: true,
    supportsFileContext: true,
    requiresPty: false,
    authType: 'mixed', // OAuth + API key + Service Account
  };

  protected readonly binaryName = 'gemini';

  private lastUsage: UsageEstimate = {};
  private rateLimitedUntil: Date | null = null;

  // ─── Auth ─────────────────────────────────────────────────

  async checkAuth(): Promise<AuthStatus> {
    // Check for API key
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      return {
        authenticated: true,
        method: 'api-key',
      };
    }

    // Check for service account
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return {
        authenticated: true,
        method: 'service-account',
      };
    }

    // Check for cached OAuth credentials
    const geminiDir = join(homedir(), '.gemini');
    try {
      await access(geminiDir, constants.R_OK);

      // The ~/.gemini directory exists — likely has cached credentials
      // Probe with a minimal command to verify
      try {
        const proc = this.spawn(['-p', '--output-format', 'json', 'ping'], {
          timeout: 15_000,
          disableColors: true,
        });

        const result = await proc;

        if (result.exitCode === 0) {
          return { authenticated: true, method: 'oauth' };
        }
      } catch {
        // Probe failed — credentials may be expired
      } finally {
        this.currentProcess = null;
      }

      return {
        authenticated: false,
        error: 'Gemini CLI session may be expired. Run `gemini` to re-authenticate.',
      };
    } catch {
      return {
        authenticated: false,
        error: 'No Gemini CLI credentials found. Run `gemini` to authenticate.',
      };
    }
  }

  // ─── Execution ──────────────────────────────────────────────

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    const args = this.buildArgs(request);

    const proc = this.spawn(args, {
      cwd: request.workingDirectory,
      timeout: request.timeout ?? 300_000,
      disableColors: true,
    });

    try {
      const rl = createInterface({
        input: proc.stdout!,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = this.parseStreamEvent(trimmed);
        if (event) {
          if (event.type === 'rate_limit') {
            this.rateLimitedUntil = event.retryAfter
              ? new Date(Date.now() + event.retryAfter * 1000)
              : new Date(Date.now() + 300_000);
          }

          if (event.type === 'done' && event.usage) {
            this.lastUsage = event.usage;
          }

          yield event;
        }
      }

      await proc;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (this.isRateLimitError(msg)) {
        yield {
          type: 'rate_limit',
          retryAfter: this.parseRetryAfter(msg),
        };
        return;
      }

      yield {
        type: 'error',
        error: msg,
        code: 'SUBPROCESS_ERROR',
      };
    } finally {
      this.currentProcess = null;
    }
  }

  // ─── Introspection ─────────────────────────────────────────

  async getUsageEstimate(): Promise<UsageEstimate> {
    return this.lastUsage;
  }

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    if (this.rateLimitedUntil && this.rateLimitedUntil > new Date()) {
      return {
        limited: true,
        resetAt: this.rateLimitedUntil,
      };
    }
    return { limited: false };
  }

  // ─── Config ────────────────────────────────────────────────

  protected override getConfigDir(): string {
    return join(homedir(), '.gemini');
  }

  // ─── Private ───────────────────────────────────────────────

  private buildArgs(request: PromptRequest): string[] {
    const args: string[] = [
      '-p', // Non-interactive prompt mode
      '--output-format',
      'stream-json', // Structured streaming output
    ];

    // The actual prompt goes last
    args.push(request.prompt);

    return args;
  }

  private parseStreamEvent(line: string): StreamEvent | null {
    try {
      const parsed = JSON.parse(line);

      // Gemini CLI stream-json format normalization
      switch (parsed.type) {
        case 'text':
        case 'content':
          return { type: 'text', content: parsed.content ?? parsed.text ?? '' };

        case 'thinking':
        case 'thought':
          return { type: 'thinking', content: parsed.content ?? '' };

        case 'tool_use':
        case 'function_call':
          return {
            type: 'tool_use',
            tool: parsed.name ?? parsed.tool ?? parsed.function_call?.name,
            input: parsed.input ?? parsed.args ?? parsed.function_call?.args,
          };

        case 'tool_result':
        case 'function_response':
          return { type: 'tool_result', result: parsed.content ?? parsed.result ?? parsed.response };

        case 'error':
          if (this.isRateLimitError(parsed.error ?? parsed.message ?? '')) {
            return {
              type: 'rate_limit',
              retryAfter: this.parseRetryAfter(parsed.error ?? parsed.message ?? ''),
            };
          }
          return { type: 'error', error: parsed.error ?? parsed.message ?? 'Unknown error' };

        case 'result':
        case 'done':
        case 'complete':
          return {
            type: 'done',
            usage: {
              inputTokens: parsed.usage?.prompt_tokens ?? parsed.usage?.input_tokens,
              outputTokens: parsed.usage?.candidates_tokens ?? parsed.usage?.output_tokens,
              totalTokens: parsed.usage?.total_tokens,
            },
          };

        default:
          if (parsed.content && typeof parsed.content === 'string') {
            return { type: 'text', content: parsed.content };
          }
          return null;
      }
    } catch {
      // Not JSON — treat as plain text
      const stripped = this.stripAnsi(line);
      if (stripped.trim()) {
        return { type: 'text', content: stripped };
      }
      return null;
    }
  }

  private isRateLimitError(message: string): boolean {
    const patterns = [
      'rate limit',
      'resource exhausted',
      '429',
      'quota exceeded',
      'too many requests',
      'throttl',
      'capacity',
    ];
    const lower = message.toLowerCase();
    return patterns.some((p) => lower.includes(p));
  }

  private parseRetryAfter(message: string): number | undefined {
    const match = message.match(/(\d+)\s*(?:seconds?|s)\b/i);
    if (match) return parseInt(match[1], 10);

    const minMatch = message.match(/(\d+)\s*(?:minutes?|m)\b/i);
    if (minMatch) return parseInt(minMatch[1], 10) * 60;

    return 300; // Default: 5 minutes
  }
}
