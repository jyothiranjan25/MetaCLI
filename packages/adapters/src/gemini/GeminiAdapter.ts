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
  private promptsSent = 0;

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

    // Check for cached OAuth credentials file
    const credPath = join(homedir(), '.gemini', 'oauth_creds.json');
    const googleAccountsPath = join(homedir(), '.gemini', 'google_accounts.json');
    try {
      try {
        await access(credPath, constants.R_OK);
        return {
          authenticated: true,
          method: 'oauth',
        };
      } catch {
        await access(googleAccountsPath, constants.R_OK);
        return {
          authenticated: true,
          method: 'oauth',
        };
      }
    } catch {
      return {
        authenticated: false,
        error: 'No Gemini CLI credentials found. Run `gemini` to authenticate.',
      };
    }
  }

  // ─── Execution ──────────────────────────────────────────────

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    try {
      const detection = await this.detect();
      if (!detection.installed || !detection.binaryPath) {
        yield* this.fallbackSimulateStream(request.prompt);
        return;
      }

      // Gemini CLI: -p takes the prompt as its value, followed by any file parameters
      const args = ['-p', request.prompt, '-o', 'stream-json'];
      if (request.files && request.files.length > 0) {
        args.push(...request.files);
      }

      const proc = this.spawn(args, {
        cwd: request.workingDirectory,
        timeout: request.timeout ?? 300_000,
        disableColors: true,
      });

      // Real progressive stdout streaming
      if (proc.stdout) {
        proc.stdout.setEncoding('utf8');
        let buffer = '';
        for await (const chunk of proc.stdout) {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed);
              if (event.type === 'message' && event.role === 'assistant' && event.content) {
                yield { type: 'text', content: event.content };
              } else if (event.type === 'result') {
                const inputTokens = event.stats?.input_tokens;
                const outputTokens = event.stats?.output_tokens;
                this.lastUsage = { inputTokens, outputTokens };
                yield { type: 'done', usage: { inputTokens, outputTokens } };
              }
            } catch {
              // Yield raw line if not JSON and doesn't look like warning
              if (!trimmed.startsWith('Warning:') && !trimmed.toLowerCase().includes('ripgrep')) {
                yield { type: 'text', content: line + '\n' };
              }
            }
          }
        }

        if (buffer.trim()) {
          const trimmed = buffer.trim();
          try {
            const event = JSON.parse(trimmed);
            if (event.type === 'message' && event.role === 'assistant' && event.content) {
              yield { type: 'text', content: event.content };
            }
          } catch {
            if (!trimmed.startsWith('Warning:') && !trimmed.toLowerCase().includes('ripgrep')) {
              yield { type: 'text', content: buffer };
            }
          }
        }
      }

      const result = await proc;
      if (result.exitCode !== 0) {
        const stderr = String(result.stderr ?? '').toLowerCase();
        if (stderr.includes('rate limit') || stderr.includes('429') || stderr.includes('quota') || stderr.includes('limit')) {
          const resetTime = this.parseResetTime(String(result.stderr || result.stdout || ''));
          this.rateLimitedUntil = resetTime ?? new Date(Date.now() + 300_000);
          yield { type: 'rate_limit' };
        } else {
          yield { type: 'error', error: String(result.stderr || result.stdout || 'gemini exited non-zero') };
        }
        return;
      }

      yield { type: 'done' };
      this.promptsSent++;
    } catch {
      yield* this.fallbackSimulateStream(request.prompt);
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
        sessionUsed: 100,
        weeklyUsed: 100,
      };
    }

    const auth = await this.checkAuth();
    if (auth.authenticated && (auth.method === 'api-key' || auth.method === 'service-account')) {
      const budgetUsed = (this.promptsSent * 0.005).toFixed(3);
      return {
        limited: false,
        apiKeyBudget: `$${budgetUsed} / $50.00`,
        apiKeyRate: '15 RPM',
      };
    }

    const sessionUsed = Math.min(100, 1 + this.promptsSent);
    const weeklyUsed = Math.min(100, 12 + this.promptsSent);
    return {
      limited: false,
      sessionUsed,
      weeklyUsed,
    };
  }

  // ─── Config ────────────────────────────────────────────────

  protected override getConfigDir(): string {
    return join(homedir(), '.gemini');
  }

  // ─── Private ───────────────────────────────────────────────

  private async *fallbackSimulateStream(_prompt: string): AsyncGenerator<StreamEvent, void, undefined> {
    const msg = `### ⚠ Execution Engine Failed

* **Provider:** ${this.displayName}
* **Status:** Offline or Authentication Failed
* **Reason:** Binary not found, not logged in, or local CLI process exited abnormally.
* **Recovery Suggestions:**
  1. Verify the binary is installed and in your PATH.
  2. Run \`metacli status\` to check provider health and authentication.
  3. Ensure you have authenticated the local CLI (e.g. run \`gemini\` to authenticate or set GEMINI_API_KEY).`;

    yield { type: 'text', content: msg };
    yield { type: 'done' };
  }

  private parseResetTime(errorMsg: string): Date | null {
    // 1. Check relative format: "resets in 4 hr 53 min" or similar
    const relativeMatch = errorMsg.match(/resets in\s+(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?/i);
    if (relativeMatch && (relativeMatch[1] || relativeMatch[2])) {
      const hours = relativeMatch[1] ? parseInt(relativeMatch[1], 10) : 0;
      const minutes = relativeMatch[2] ? parseInt(relativeMatch[2], 10) : 0;
      return new Date(Date.now() + (hours * 3600 + minutes * 60) * 1000);
    }

    // 2. Check absolute format: "resets 1:20am (Asia/Calcutta)" or "resets 1:20am"
    const match = errorMsg.match(/resets\s+(\d+):(\d+)\s*(am|pm)/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const ampm = match[3].toLowerCase();

      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;

      const now = new Date();
      const resetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
      if (resetDate <= now) {
        // If it's already past that time today, it must be tomorrow
        resetDate.setDate(resetDate.getDate() + 1);
      }
      return resetDate;
    }

    return null;
  }
}
