/**
 * META-CLI COGNITIVE INTELLIGENCE LAYER
 * System: Semantic Refactor Safety Engine
 * 
 * Safeguards proposed refactoring plans by computing risk metrics and prerequisites.
 */

import { EventBus } from '@metacli/core';

export interface SafetyAssessment {
  proposalId: string;
  isSafe: boolean;
  confidenceScore: number;
  riskFactors: string[];
  mandatoryPreconditions: string[];
}

export class RefactorSafetyEngine {
  constructor(protected __eventBus: EventBus) {}

  /**
   * Evaluates a proposed architectural change for safety and blast radius.
   */
  public async evaluateProposalSafety(planId: string, diffPreview: string): Promise<SafetyAssessment> {
    const riskFactors: string[] = [];
    const mandatoryPreconditions: string[] = [];

    // Analyze diff preview for dangerous keywords
    if (diffPreview.toLowerCase().includes('delete') || diffPreview.toLowerCase().includes('remove')) {
      riskFactors.push('Destructive code removal detected.');
      mandatoryPreconditions.push('Verify structural references using AST search.');
    }

    if (diffPreview.toLowerCase().includes('auth') || diffPreview.toLowerCase().includes('security')) {
      riskFactors.push('Authentication module modifications detected.');
      mandatoryPreconditions.push('Verify with unit test suites compile checks.');
    }

    const isSafe = riskFactors.length <= 1;
    const confidenceScore = isSafe ? 0.92 : 0.48;

    const assessment: SafetyAssessment = {
      proposalId: planId,
      isSafe,
      confidenceScore,
      riskFactors,
      mandatoryPreconditions,
    };

    if (isSafe) {
      this.__eventBus.emit('refactor.approved' as any, assessment as any);
    } else {
      this.__eventBus.emit('safety.warning' as any, assessment as any);
    }

    return assessment;
  }
}
