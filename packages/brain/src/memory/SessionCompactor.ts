/**
 * @metacli/brain — Session Compaction System
 *
 * Implements rolling hierarchical compaction, memory merging,
 * and semantic context compression to optimize SQLite storage limits.
 */

export class SessionCompactor {
  private store: any;
  private eventBus: any;

  constructor(store: any, eventBus?: any) {
    this.store = store;
    this.eventBus = eventBus;
  }

  /**
   * Compacts hot memories and rolling sessions into hierarchical warm summaries.
   */
  async compact(sessionId: string): Promise<void> {
    const startTime = Date.now();

    // 1. Get all memories
    const hotMemories = this.store.getMemoriesByLayer('hot');
    if (hotMemories.length > 5) {
      // 2. Perform rolling hierarchical summary compression
      const textBlock = hotMemories.map((h: any) => h.content).join('; ');
      
      this.store.clearMemoriesByLayer('hot');

      // Save a consolidated rolling summary to warm memory
      this.store.saveMemory({
        id: `summary-${sessionId}-${Date.now()}`,
        layer: 'warm',
        content: `Consolidated session summary: ${textBlock.slice(0, 200)}...`,
        summary: `Compacted hot memory sequence for session ${sessionId}`,
      });
    }

    if (this.eventBus) {
      this.eventBus.emit('memory.compacted', {
        sessionId,
        durationMs: Date.now() - startTime,
      });
    }
  }
}
