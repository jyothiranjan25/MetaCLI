/**
 * MetaCLI Core — Gemini Transport
 *
 * Manages stateless (CLI) or persistent (Runtime/Hybrid) connections to Gemini.
 */

import { execa, type ExecaChildProcess } from 'execa';
import type { ProviderTransport, TransportMode } from './ProviderTransport.js';
import type { StreamEvent, PromptRequest } from '../../events/types.js';

export class GeminiTransport implements ProviderTransport {
  readonly providerId = 'gemini-cli';
  private process: ExecaChildProcess | null = null;
  private connected = false;

  constructor(readonly mode: TransportMode = 'hybrid') {}

  async connect(): Promise<void> {
    if (this.mode === 'cli') return;
    if (this.connected) return;

    try {
      this.process = execa('gemini', ['-h'], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, NO_COLOR: '1' },
      });
      this.connected = true;
    } catch {
      this.connected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    try {
      const proc = execa('gemini', ['-p', request.prompt], {
        cwd: request.workingDirectory,
        stdin: 'ignore',
        env: { ...process.env, NO_COLOR: '1' },
      });
      
      this.process = proc;

      const result = await proc;
      const raw = String(result.stdout ?? '').trim();
      if (raw) {
        for (const chunk of raw.split(/(\s+)/)) {
          if (chunk) yield { type: 'text', content: chunk };
        }
      }
    } catch (err: any) {
      yield { type: 'error', error: err.message };
    } finally {
      this.process = null;
    }
    yield { type: 'done' };
  }

  async cancel(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
      await this.connect();
    }
  }

  async pause(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGSTOP');
    }
  }

  async resume(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGCONT');
    }
  }
}
