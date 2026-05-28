/**
 * MetaCLI Core — Retrieval Explainability Engine
 *
 * Provides human-readable trace reasoning outlining why files,
 * dependencies, memory, or context buffers were automatically fetched.
 */

export interface TraceReason {
  filePath: string;
  score: number;
  rationale: string;
}

export class RetrievalExplainabilityEngine {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Generates a trace breakdown of selection rationales.
   */
  explain(selectedPaths: string[], intent: any): TraceReason[] {
    const traces = selectedPaths.map((filePath) => {
      let score = 0.5;
      let rationale = 'Loaded by default scan rules.';

      if (intent === 'refactor' || intent === 'architecture') {
        score = 0.9;
        rationale = `High correlation to active architectural modularity intent (${intent})`;
      } else if (filePath.includes('test') || filePath.includes('spec')) {
        score = 0.8;
        rationale = 'Included for testing context and verification assert patterns';
      } else if (filePath.includes('index') || filePath.includes('main')) {
        score = 0.7;
        rationale = 'Identified as workspace entry-point boundary node';
      }

      return {
        filePath,
        score,
        rationale,
      };
    });

    if (this.eventBus) {
      this.eventBus.emit('retrieval.explained', {
        matchCount: traces.length,
      });
    }

    return traces;
  }
}
