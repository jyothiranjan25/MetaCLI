/**
 * META-CLI COGNITIVE INTELLIGENCE LAYER
 * System: Failure Learning Engine
 * 
 * Extracts anti-patterns and negative design constraints from failed tests, rollbacks, and compiler errors.
 */

import { EventBus } from '@metacli/core';

export interface FailureConstraint {
  constraintId: string;
  contextScope: string[];
  antiPattern: string;
  failureReason: string;
  sourceEvent: string;
}

export class FailureLearningEngine {
  constructor(protected __eventBus: EventBus) {}

  /**
   * Analyzes a failed outcome and extracts a reusable architectural constraint.
   */
  public async learnFromFailure(failureContext: string, diff: string): Promise<FailureConstraint> {
    const contextScope = ['packages/core', 'apps/cli'];
    const antiPattern = diff.includes('pnpm') ? 'Mixing workspace managers inside composite packages settings.'
                      : 'Ad-hoc shell processes command executions without sandbox path boundaries.';

    const constraint: FailureConstraint = {
      constraintId: `constraint-${Date.now()}`,
      contextScope,
      antiPattern,
      failureReason: failureContext,
      sourceEvent: 'test.failed',
    };

    this.__eventBus.emit('failure.analyzed' as any, constraint as any);
    this.__eventBus.emit('constraint.added' as any, constraint as any);

    return constraint;
  }
}
