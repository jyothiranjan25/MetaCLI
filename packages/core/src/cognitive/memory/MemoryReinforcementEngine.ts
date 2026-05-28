/**
 * MetaCLI Core — Memory Reinforcement Engine
 *
 * Actively decays confidence weights of old, stale memory keys while reinforcing
 * frequently used blocks to maintain an evolving, high-value relational index.
 */

export interface ReinforcedMemory {
  key: string;
  confidence: number;
  reinforced: boolean;
}

export class MemoryReinforcementEngine {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Refines memory weightings based on touch logs.
   */
  reinforceMemory(
    key: string,
    currentConfidence: number,
    accessCount: number,
    daysSinceLastAccess: number
  ): ReinforcedMemory {
    let confidence = currentConfidence;
    let reinforced = false;

    if (accessCount > 5) {
      confidence = Math.min(1.0, confidence + 0.15);
      reinforced = true;
    }

    if (daysSinceLastAccess > 7) {
      confidence = Math.max(0.1, confidence - 0.25);
    }

    const result = { key, confidence, reinforced };

    if (this.eventBus) {
      if (reinforced) {
        this.eventBus.emit('memory.reinforced', { key, confidence });
      } else {
        this.eventBus.emit('memory.refined', { key, confidence });
      }
    }

    return result;
  }
}
