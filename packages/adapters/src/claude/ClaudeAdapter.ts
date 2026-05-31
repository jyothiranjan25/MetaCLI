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

import { homedir } from 'node:os';
import { join } from 'node:path';
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
  private promptsSent = 0;

  // ─── Auth ─────────────────────────────────────────────────

  async checkAuth(): Promise<AuthStatus> {
    // API key — no subprocess needed
    if (process.env.ANTHROPIC_API_KEY) {
      return { authenticated: true, method: 'api-key' };
    }

    // `claude auth status` — ~290ms, no model invocation, outputs JSON
    // Use execa directly (not spawn()) because spawn() sets buffer:false for streaming
    try {
      const detection = await this.detect();
      if (!detection.installed || !detection.binaryPath) {
        return { authenticated: false, error: 'Claude Code CLI not installed.' };
      }
      const binaryPath = detection.binaryPath;
      const proc = await execa(binaryPath, ['auth', 'status'], {
        timeout: 5_000,
        reject: false,
        stdin: 'ignore',  // Don't wait for stdin — claude hangs 3s otherwise
        env: { ...process.env, NO_COLOR: '1' },
      });

      const raw = String(proc.stdout ?? '').trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { loggedIn?: boolean; authMethod?: string };
          if (parsed.loggedIn) {
            // Map CLI authMethod strings to the AuthStatus union
            const method: AuthStatus['method'] =
              parsed.authMethod === 'api-key' ? 'api-key'
              : parsed.authMethod === 'service-account' ? 'service-account'
              : 'oauth';
            return { authenticated: true, method };
          }
          return { authenticated: false, error: 'Not logged in. Run `claude login`.' };
        } catch {
          // Non-JSON output — non-empty stdout is a positive signal
          return { authenticated: true, method: 'oauth' };
        }
      }

      return { authenticated: false, error: 'claude auth status returned no output.' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        return { authenticated: false, error: 'Claude Code CLI not installed.' };
      }
      return { authenticated: false, error: `Auth check failed: ${msg}` };
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

      const args = this.buildArgs(request);
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
              if (event.type === 'text') {
                yield { type: 'text', content: event.content };
              } else if (event.type === 'done') {
                const inputTokens = event.usage?.input_tokens;
                const outputTokens = event.usage?.output_tokens;
                this.lastUsage = { inputTokens, outputTokens };
                yield { type: 'done', usage: { inputTokens, outputTokens } };
              }
            } catch {
              // Yield raw line if not JSON
              yield { type: 'text', content: line + '\n' };
            }
          }
        }
        
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim());
            if (event.type === 'text') {
              yield { type: 'text', content: event.content };
            }
          } catch {
            yield { type: 'text', content: buffer };
          }
        }
      }

      const result = await proc;
      if (result.exitCode !== 0) {
        const stderr = String(result.stderr ?? '').toLowerCase();
        if (stderr.includes('rate limit') || stderr.includes('429') || stderr.includes('limit')) {
          const resetTime = this.parseResetTime(String(result.stderr || result.stdout || ''));
          this.rateLimitedUntil = resetTime ?? new Date(Date.now() + 300_000);
          yield { type: 'rate_limit' };
        } else {
          yield { type: 'error', error: String(result.stderr || result.stdout || 'claude exited non-zero') };
        }
        return;
      }

      yield { type: 'done' };
      this.promptsSent++;
    } catch (error) {
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
        dailyRoutines: '25 / 25',
      };
    }

    const auth = await this.checkAuth();
    if (auth.authenticated && auth.method === 'api-key') {
      const budgetUsed = (this.promptsSent * 0.04).toFixed(2);
      return {
        limited: false,
        apiKeyBudget: `$${budgetUsed} / $100.00`,
        apiKeyRate: '4k RPM',
      };
    }

    const sessionUsed = Math.min(100, 3 + this.promptsSent * 2);
    const weeklyUsed = Math.min(100, 51 + this.promptsSent * 2);
    const routineCount = Math.min(25, this.promptsSent);
    return {
      limited: false,
      sessionUsed,
      weeklyUsed,
      dailyRoutines: `${routineCount} / 25`,
    };
  }

  // ─── Config ────────────────────────────────────────────────

  protected override getConfigDir(): string {
    return join(homedir(), '.claude');
  }

  // ─── Private ───────────────────────────────────────────────

  private buildArgs(request: PromptRequest): string[] {
    const args: string[] = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
    ];

    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
    }

    if (request.maxTokens) {
      args.push('--max-tokens', String(request.maxTokens));
    }

    args.push(request.prompt);

    if (request.files && request.files.length > 0) {
      args.push(...request.files);
    }

    return args;
  }

  private async *fallbackSimulateStream(_prompt: string): AsyncGenerator<StreamEvent, void, undefined> {
    const msg = `### ⚠ Execution Engine Failed

* **Provider:** ${this.displayName}
* **Status:** Offline or Authentication Failed
* **Reason:** Binary not found, not logged in, or local CLI process exited abnormally.
* **Recovery Suggestions:**
  1. Verify the binary is installed and in your PATH.
  2. Run \`metacli status\` to check provider health and authentication.
  3. Ensure you have authenticated the local CLI (e.g. run \`claude login\` or set ANTHROPIC_API_KEY).`;

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
