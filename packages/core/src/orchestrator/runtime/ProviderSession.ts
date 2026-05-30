/**
 * MetaCLI Core — Provider Session
 *
 * Represents an active, portable connection state context with an AI provider.
 */

import { randomUUID } from 'node:crypto';
import type { ProviderTransport } from '../transports/ProviderTransport.js';
import type { StreamEvent, PromptRequest } from '../../events/types.js';

export class ProviderSession {
  readonly id = randomUUID();
  private state: 'idle' | 'active' | 'closed' = 'idle';
  private promptsSent = 0;
  private tokenCount = 0;

  constructor(
    readonly providerId: string,
    private transport: ProviderTransport,
  ) {}

  async *sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined> {
    this.state = 'active';
    this.promptsSent++;
    try {
      for await (const event of this.transport.sendPrompt(request)) {
        if (event.type === 'text') {
          this.tokenCount += Math.ceil(event.content.length / 4);
        }
        yield event;
      }
    } finally {
      this.state = 'idle';
    }
  }

  getState(): 'idle' | 'active' | 'closed' {
    return this.state;
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
