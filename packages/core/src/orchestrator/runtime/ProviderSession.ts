import { randomUUID } from 'node:crypto';
import type { ProviderTransport } from '../transports/ProviderTransport.js';
import type { StreamEvent, PromptRequest } from '../../events/types.js';

export type SessionState = 'idle' | 'acquiring' | 'active' | 'paused' | 'released' | 'failed' | 'closed';

export class ProviderSession {
  readonly id = randomUUID();
  private state: SessionState = 'idle';
  private promptsSent = 0;
  private tokenCount = 0;

  constructor(
    readonly providerId: string,
    private transport: ProviderTransport,
  ) {}

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    this.setState('active');
    this.promptsSent++;
    try {
      for await (const event of this.transport.sendPrompt(request)) {
        if (event.type === 'text') {
          this.tokenCount += Math.ceil(event.content.length / 4);
        }
        yield event;
      }
      this.setState('released');
    } catch (err) {
      this.setState('failed');
      throw err;
    }
  }

  getState(): SessionState {
    return this.state;
  }

  setState(state: SessionState): void {
    this.state = state;
  }

  getPromptsSent(): number {
    return this.promptsSent;
  }

  getTokenCount(): number {
    return this.tokenCount;
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}
