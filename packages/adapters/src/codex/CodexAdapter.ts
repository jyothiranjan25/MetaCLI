/**
 * MetaCLI Adapters — Codex CLI Adapter
 *
 * Orchestrates Codex CLI (OpenAI) as a subprocess.
 *
 * Key behaviors:
 * - Uses `codex exec <prompt>` for non-interactive execution
 * - Auth: OpenAI account via `codex login`
 * - Output: plain text with a header block that gets stripped
 * - Rate limits: usage-limit errors returned from the CLI
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

export class CodexAdapter extends SubprocessAdapter {
  readonly id = 'codex-cli';
  readonly displayName = 'Codex CLI';
  readonly capabilities: AdapterCapabilities = {
    supportsStreaming: true,
    supportsJsonOutput: false,
    supportsNonInteractive: true,
    supportsFileContext: false,
    requiresPty: false,
    authType: 'api-key',
  };

  protected readonly binaryName = 'codex';

  private lastUsage: UsageEstimate = {};
  private rateLimitedUntil: Date | null = null;

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

      // codex exec reads stdin even with a prompt arg — stdin:'ignore' prevents hanging
      const proc = await execa(
        detection.binaryPath,
        ['exec', request.prompt],
        {
          cwd: request.workingDirectory,
          timeout: request.timeout ?? 300_000,
          env: { ...process.env, NO_COLOR: '1' },
          stdin: 'ignore',
          reject: false,
        },
      );

      // Combine stdout + stderr and strip ANSI
      const raw = this.stripAnsi(
        String(proc.stdout ?? '') + String(proc.stderr ?? ''),
      ).trim();

      // Rate limit / usage limit detection
      if (
        raw.toLowerCase().includes('usage limit') ||
        raw.toLowerCase().includes('rate limit') ||
        raw.includes('429')
      ) {
        yield { type: 'rate_limit' };
        this.rateLimitedUntil = new Date(Date.now() + 300_000);
        return;
      }

      if (proc.exitCode !== 0 && !raw) {
        yield { type: 'error', error: 'codex exited non-zero with no output' };
        return;
      }

      // Strip the codex header block:
      // "OpenAI Codex vX.Y.Z\n--------\n<metadata>\n--------\nuser\n<prompt>\n"
      const responseText = this.extractCodexResponse(raw, request.prompt);

      if (!responseText) {
        yield { type: 'error', error: 'Empty response from codex' };
        return;
      }

      for (const chunk of responseText.split(/(\s+)/)) {
        if (chunk) yield { type: 'text', content: chunk };
      }

      yield { type: 'done' };
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
      return { limited: true, resetAt: this.rateLimitedUntil };
    }
    return { limited: false };
  }

  protected override getConfigDir(): string {
    return '';
  }

  /**
   * Codex output has a header block:
   *   OpenAI Codex v...
   *   --------
   *   workdir: ...
   *   model: ...
   *   ...
   *   --------
   *   user
   *   <prompt text>
   *   <assistant response>
   *
   * This strips the header and user block, returning just the response.
   */
  private extractCodexResponse(raw: string, prompt: string): string {
    // Find the last "--------" separator — that's where user/assistant block begins
    const lastSepIdx = raw.lastIndexOf('--------');
    if (lastSepIdx < 0) return raw.trim();

    let after = raw.slice(lastSepIdx + 8).trim(); // skip "--------"

    // Skip "user" label line
    if (after.startsWith('user')) {
      after = after.slice(4).trim();
    }

    // Skip the echoed prompt (first non-empty block matching the prompt)
    const promptStart = after.indexOf(prompt.slice(0, 20));
    if (promptStart === 0) {
      after = after.slice(prompt.length).trim();
    }

    return after.trim();
  }

  private async *fallbackSimulateStream(_prompt: string): AsyncGenerator<StreamEvent, void, undefined> {
    const response = `I'm Codex, but couldn't connect to the CLI. Run \`codex login\` to authenticate, then retry.`;
    for (const chunk of response.split(/(\s+)/)) {
      yield { type: 'text', content: chunk };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    yield { type: 'done' };
  }
}
