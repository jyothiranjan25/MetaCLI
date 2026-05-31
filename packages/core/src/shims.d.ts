declare module '@metacli/brain' {
  export interface FileRecord {
    path: string;
    hash: string;
    size: number;
    importance: number;
    summary?: string;
    lastIndexed?: string;
  }

  export interface MemoryRecord {
    id: string;
    timestamp?: string;
    layer: 'hot' | 'warm' | 'cold';
    content: string;
    summary?: string;
    embedding?: string;
    metadata?: string;
  }

  export class BrainStore {
    constructor(projectRoot: string);
    getAllFiles(): FileRecord[];
    getMemoriesByLayer(layer: 'hot' | 'warm' | 'cold'): MemoryRecord[];
    saveMemory(memory: MemoryRecord): void;
    close(): void;
  }

  export class MemoryManager {
    constructor(store: BrainStore);
    addMemory(
      layer: 'hot' | 'warm' | 'cold',
      content: string,
      options?: {
        summary?: string;
        embedding?: number[];
        metadata?: Record<string, any>;
      }
    ): string;
  }

  export class SessionCompactor {
    constructor(store: BrainStore, eventBus?: any);
    compact(sessionId: string): Promise<void>;
  }
}
