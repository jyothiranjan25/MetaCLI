/**
 * MetaCLI Core — Intent Classification Engine
 *
 * Classifies developer prompts dynamically into logical software categories:
 * - Refactor
 * - Debug
 * - Architecture
 * - Migration
 * - Optimize
 * - Test
 * - Security
 * - Document
 * - General
 */

export type IntentType =
  | 'refactor'
  | 'debug'
  | 'architecture'
  | 'migration'
  | 'optimize'
  | 'test'
  | 'security'
  | 'document'
  | 'general';

export interface IntentClassification {
  primaryIntent: IntentType;
  confidence: number;
  secondaryIntents: IntentType[];
}

export class IntentClassifier {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Evaluates user prompt syntax to classify developer intent.
   */
  async classify(prompt: string): Promise<IntentClassification> {
    const text = prompt.toLowerCase();
    
    const intentScores: Record<IntentType, number> = {
      refactor: 0,
      debug: 0,
      architecture: 0,
      migration: 0,
      optimize: 0,
      test: 0,
      security: 0,
      document: 0,
      general: 1, // base score
    };

    // Heuristics
    if (/\b(refactor|clean|restructure|rename|extract|modular)\b/.test(text)) {
      intentScores.refactor += 5;
    }
    if (/\b(debug|fix|bug|crash|error|fail|issue|trace|log)\b/.test(text)) {
      intentScores.debug += 5;
    }
    if (/\b(architecture|design|structure|pattern|coupling|module|boundary)\b/.test(text)) {
      intentScores.architecture += 5;
    }
    if (/\b(migrate|upgrade|version|deprecate|port|move)\b/.test(text)) {
      intentScores.migration += 5;
    }
    if (/\b(optimize|fast|perf|performance|memory|leak|speed|slow)\b/.test(text)) {
      intentScores.optimize += 5;
    }
    if (/\b(test|spec|assert|coverage|mock|unit|e2e|integration)\b/.test(text)) {
      intentScores.test += 5;
    }
    if (/\b(security|vulnerability|auth|secret|crypt|encrypt|leak|audit|cors)\b/.test(text)) {
      intentScores.security += 5;
    }
    if (/\b(document|doc|readme|comment|guide|tutorial|inline)\b/.test(text)) {
      intentScores.document += 5;
    }

    // Determine primary and secondary intents
    const sorted = Object.entries(intentScores)
      .sort((a, b) => b[1] - a[1]);

    const primaryIntent = sorted[0][0] as IntentType;
    const maxScore = sorted[0][1];
    
    // Confidence calculation (capped at 0.95, base 0.5)
    const confidence = maxScore > 1 ? Math.min(0.5 + maxScore * 0.08, 0.95) : 0.5;

    const secondaryIntents = sorted
      .slice(1)
      .filter(([_, score]) => score > 2)
      .map(([intent]) => intent as IntentType);

    if (this.eventBus) {
      this.eventBus.emit('intent.detected', {
        prompt,
        intent: primaryIntent,
        confidence,
      });
    }

    return {
      primaryIntent,
      confidence,
      secondaryIntents,
    };
  }
}
