/**
 * META-CLI COGNITIVE INTELLIGENCE LAYER
 * System: Engineering Mood / State Analyzer
 * 
 * Analyzes developer interaction volatility to adapt AI's tone and advice strategy.
 */

import { EventBus } from '@metacli/core';

export type EngineeringState = 'flow' | 'exploring' | 'frustrated' | 'blocked';

export class EngineeringStateAnalyzer {
  constructor(protected __eventBus: EventBus) {}

  /**
   * Evaluates recent session events to determine the developer's current state.
   */
  public analyzeSessionState(recentEvents: any[]): EngineeringState {
    let failureCount = 0;
    let revertCount = 0;

    for (const event of recentEvents) {
      if (event?.type === 'test.failed' || event?.status === 'failed') {
        failureCount++;
      }
      if (event?.type === 'commit.reverted' || event?.action === 'rollback') {
        revertCount++;
      }
    }

    if (failureCount >= 3 || revertCount >= 2) {
      this.__eventBus.emit('state.volatility.increased' as any, { volatility: 8.0 } as any);
      return 'frustrated';
    }

    if (failureCount > 0) {
      return 'exploring';
    }

    return 'flow';
  }
}
