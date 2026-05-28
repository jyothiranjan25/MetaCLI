/**
 * MetaCLI Adapters — Claude Code Adapter
 *
 * Orchestrates Claude Code CLI as a subprocess.
 *
 * Key behaviors:
 * - Uses `claude -p --output-format stream-json` for non-interactive streaming
 * - Auth: OAuth browser login or ANTHROPIC_API_KEY
 * - Credentials stored in ~/.claude/.credentials.json or macOS Keychain
 * - Rate limits: 5-hour rolling window (subscription), RPM/TPM (API key)
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

export class ClaudeAdapter extends SubprocessAdapter {
  readonly id = 'claude-code';
  readonly displayName = 'Claude Code';
  readonly capabilities: AdapterCapabilities = {
    supportsStreaming: true,
    supportsJsonOutput: true,
    supportsNonInteractive: true,
    supportsFileContext: true,
    requiresPty: false,
    authType: 'mixed', // OAuth + API key
  };

  protected readonly binaryName = 'claude';

  private lastUsage: UsageEstimate = {};
  private rateLimitedUntil: Date | null = null;

  // ─── Auth ─────────────────────────────────────────────────

  async checkAuth(): Promise<AuthStatus> {
    // Check for API key first (most reliable for automation)
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        authenticated: true,
        method: 'api-key',
      };
    }

    // Check for OAuth credentials file
    const credPath = join(homedir(), '.claude', '.credentials.json');
    try {
      await access(credPath, constants.R_OK);
      return {
        authenticated: true,
        method: 'oauth',
      };
    } catch {
      // No credentials file found
    }

    // Try a lightweight probe — run claude with a minimal prompt
    try {
      const proc = this.spawn(['-p', '--output-format', 'json', '--max-turns', '1', 'ping'], {
        timeout: 15_000,
        disableColors: true,
      });

      const result = await proc;

      if (result.exitCode === 0) {
        return { authenticated: true, method: 'oauth' };
      }

      return {
        authenticated: false,
        error: 'Claude Code session expired. Run `claude login` to re-authenticate.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('not found') || msg.includes('ENOENT')) {
        return { authenticated: false, error: 'Claude Code CLI not installed' };
      }

      return {
        authenticated: false,
        error: `Auth check failed: ${msg}`,
      };
    } finally {
      this.currentProcess = null;
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
      // Stream stdout line-by-line (stream-json emits newline-delimited JSON)
      const rl = createInterface({
        input: proc.stdout!,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = this.parseStreamEvent(trimmed);
        if (event) {
          // Track rate limits
          if (event.type === 'rate_limit') {
            this.rateLimitedUntil = event.retryAfter
              ? new Date(Date.now() + event.retryAfter * 1000)
              : new Date(Date.now() + 300_000);
          }

          // Track usage
          if (event.type === 'done' && event.usage) {
            this.lastUsage = event.usage;
          }

          yield event;
        }
      }

      // Wait for process to complete
      await proc;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Check if it's a rate limit error
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
    return join(homedir(), '.claude');
  }

  // ─── Private ───────────────────────────────────────────────

  private buildArgs(request: PromptRequest): string[] {
    const args: string[] = [
      '-p', // Non-interactive prompt mode
      '--output-format',
      'stream-json', // Structured streaming output
    ];

    // Add system prompt if provided
    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
    }

    // Add max tokens if specified
    if (request.maxTokens) {
      args.push('--max-tokens', String(request.maxTokens));
    }

    // The actual prompt goes last
    args.push(request.prompt);

    return args;
  }

  private parseStreamEvent(line: string): StreamEvent | null {
    try {
      const parsed = JSON.parse(line);

      // Claude Code stream-json format normalization
      switch (parsed.type) {
        case 'assistant':
        case 'text':
          return { type: 'text', content: parsed.content ?? parsed.text ?? '' };

        case 'thinking':
          return { type: 'thinking', content: parsed.content ?? '' };

        case 'tool_use':
          return { type: 'tool_use', tool: parsed.name ?? parsed.tool, input: parsed.input };

        case 'tool_result':
          return { type: 'tool_result', result: parsed.content ?? parsed.result };

        case 'error':
          // Check for rate limit in error
          if (this.isRateLimitError(parsed.error ?? parsed.message ?? '')) {
            return {
              type: 'rate_limit',
              retryAfter: this.parseRetryAfter(parsed.error ?? parsed.message ?? ''),
            };
          }
          return { type: 'error', error: parsed.error ?? parsed.message ?? 'Unknown error' };

        case 'result':
        case 'done':
          return {
            type: 'done',
            usage: {
              inputTokens: parsed.usage?.input_tokens ?? parsed.input_tokens,
              outputTokens: parsed.usage?.output_tokens ?? parsed.output_tokens,
              totalTokens:
                (parsed.usage?.input_tokens ?? 0) + (parsed.usage?.output_tokens ?? 0) || undefined,
            },
          };

        default:
          // Try to extract text content from unknown formats
          if (parsed.content && typeof parsed.content === 'string') {
            return { type: 'text', content: parsed.content };
          }
          // Skip unknown event types silently
          return null;
      }
    } catch {
      // Not valid JSON — treat as plain text output
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
      'limit reached',
      'too many requests',
      '429',
      'quota exceeded',
      'capacity',
      'throttl',
    ];
    const lower = message.toLowerCase();
    return patterns.some((p) => lower.includes(p));
  }

  private parseRetryAfter(message: string): number | undefined {
    // Try to extract retry-after seconds from error message
    const match = message.match(/(\d+)\s*(?:seconds?|s)\b/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Try to extract minutes
    const minMatch = message.match(/(\d+)\s*(?:minutes?|m)\b/i);
    if (minMatch) {
      return parseInt(minMatch[1], 10) * 60;
    }

    // Default: 5 minutes
    return 300;
  }
}
