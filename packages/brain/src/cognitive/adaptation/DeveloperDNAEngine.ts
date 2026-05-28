/**
 * META-CLI COGNITIVE INTELLIGENCE LAYER
 * System: Developer DNA Engine
 * 
 * Learns preferred naming, formatting, and structural patterns from developer code edits.
 */

import { EventBus } from '@metacli/core';

export interface DeveloperDNA {
  userId: string;
  preferences: Record<string, string>;
  learnedPatterns: string[];
  confidence: number;
}

export class DeveloperDNAEngine {
  private currentDNA: DeveloperDNA = {
    userId: 'default-user',
    preferences: {
      errorHandling: 'try-catch',
      namingConvention: 'camelCase',
      semicolons: 'true',
    },
    learnedPatterns: [],
    confidence: 0.5,
  };

  constructor(protected __eventBus: EventBus) {}

  /**
   * Observes an interaction and extracts potential stylistic preferences to update the DNA.
   */
  public async observeInteraction(originalCode: string, acceptedCode: string): Promise<void> {
    const preferences: Record<string, string> = { ...this.currentDNA.preferences };
    const patterns = new Set<string>(this.currentDNA.learnedPatterns);

    // Simple robust heuristics to extract preferences
    if (acceptedCode.includes('try {') || acceptedCode.includes('catch(')) {
      preferences.errorHandling = 'try-catch';
    } else if (acceptedCode.includes('.catch(')) {
      preferences.errorHandling = 'promises';
    }

    if (acceptedCode.includes(';') && !originalCode.includes(';')) {
      preferences.semicolons = 'true';
      patterns.add('Uses semicolons explicitly');
    } else if (!acceptedCode.includes(';') && originalCode.includes(';')) {
      preferences.semicolons = 'false';
      patterns.add('Prefers clean script without semicolons');
    }

    if (acceptedCode.includes('const ') && !originalCode.includes('const ')) {
      patterns.add('Prefers const for immutability');
    }

    this.currentDNA = {
      userId: 'default-user',
      preferences,
      learnedPatterns: Array.from(patterns),
      confidence: Math.min(1.0, this.currentDNA.confidence + 0.05),
    };

    this.__eventBus.emit('dna.updated' as any, this.currentDNA as any);
  }

  /**
   * Retrieves the current materialized DNA profile for context injection.
   */
  public async getActiveDNA(): Promise<DeveloperDNA> {
    return this.currentDNA;
  }
}
