/**
 * MetaCLI Core — Provider Transport Interface
 *
 * Abstract transport contract. MetaCLI interacts exclusively with transports,
 * completely decoupling session management from OS processes or subprocess lifecycles.
 */

import type { StreamEvent, PromptRequest } from '../../events/types.js';

export type TransportMode = 'cli' | 'runtime' | 'hybrid';

export interface ProviderTransport {
  readonly providerId: string;
  readonly mode: TransportMode;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined>;
  cancel(): Promise<void>;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
}
