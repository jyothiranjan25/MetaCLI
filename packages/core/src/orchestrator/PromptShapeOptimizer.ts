import type { ProviderTokenProfile } from './ProviderTokenProfiles.js';

export interface PromptShape {
  systemInstructions: string;
  prompt: string;
  estimatedTokens: number;
}

export class PromptShapeOptimizer {
  shape(userPrompt: string, context: string, profile: ProviderTokenProfile, outputDirective: string): PromptShape {
    const systemInstructions = [
      'You are MetaCLI, a token-efficient semantic engineering compiler.',
      'Use only the provided dense context unless a missing fact is essential.',
      outputDirective,
    ].join(' ');

    let prompt: string;
    if (profile.preferredStructure === 'xml') {
      prompt = `<task>${this.escape(userPrompt)}</task>\n<context>${this.escape(context)}</context>`;
    } else if (profile.preferredStructure === 'json') {
      prompt = JSON.stringify({ task: userPrompt, context, constraints: ['minimize tokens', 'avoid repeated context'] });
    } else if (profile.preferredStructure === 'plain') {
      prompt = `TASK\n${userPrompt}\n\nDENSE CONTEXT\n${context}`;
    } else {
      prompt = `## Task\n${userPrompt}\n\n## Dense Context\n${context}`;
    }

    return { systemInstructions, prompt, estimatedTokens: Math.ceil((systemInstructions.length + prompt.length) / 4) };
  }

  private escape(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
