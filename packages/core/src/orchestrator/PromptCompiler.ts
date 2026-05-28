/**
 * MetaCLI Core — Prompt Compiler System
 *
 * Compiles user inputs, codebase contexts, architectural drift rules,
 * and memory segments into a unified, token-optimized layout targeted at
 * specific model behaviors.
 */

import { ContextOptimizer } from './ContextOptimizer.js';
import { IntentClassifier } from './IntentClassifier.js';

export interface CompileOptions {
  providerId: string;
  injectMemory?: boolean;
  injectArchitecture?: boolean;
  contextItems?: Array<{
    path: string;
    content: string;
    importance: number;
    relevanceScore: number;
  }>;
}

export interface CompiledPrompt {
  providerId: string;
  prompt: string;
  systemInstructions?: string;
  estimatedTokens: number;
}

export class PromptCompiler {
  private eventBus: any;
  private contextOptimizer: ContextOptimizer;
  private intentClassifier: IntentClassifier;

  constructor(eventBus?: any, contextOptimizer?: ContextOptimizer, intentClassifier?: IntentClassifier) {
    this.eventBus = eventBus;
    this.contextOptimizer = contextOptimizer || new ContextOptimizer(eventBus);
    this.intentClassifier = intentClassifier || new IntentClassifier(eventBus);
  }

  /**
   * Compiles the raw prompt into provider-optimized templates.
   */
  async compile(
    userPrompt: string,
    options: CompileOptions
  ): Promise<CompiledPrompt> {
    // 1. Identify intent
    const classification = await this.intentClassifier.classify(userPrompt);

    // 2. Build context optimization
    let contextBlock = '';
    let saved = 0;
    
    if (options.contextItems && options.contextItems.length > 0) {
      const budget = { maxTokens: 4000, reserveTokens: 1000 };
      const optimized = this.contextOptimizer.optimize(
        options.contextItems,
        budget,
        options.providerId
      );

      saved = optimized.tokensSaved;
      contextBlock = optimized.items
        .map((item) => `[File Path: ${item.path}]\n${item.content}`)
        .join('\n\n');

      if (optimized.compressedSummary) {
        contextBlock += `\n\n${optimized.compressedSummary}`;
      }
    }

    // 3. Provider specialized formatting (e.g. Claude XML vs Gemini markdown templates)
    let compiledPrompt = '';
    let systemInstructions = '';

    if (options.providerId.includes('claude')) {
      systemInstructions = `You are a senior principal systems architect and software engineer. Assist the developer cleanly and modularly. Intent: ${classification.primaryIntent.toUpperCase()}.`;
      compiledPrompt = `<context>\n${contextBlock}\n</context>\n\n<developer_prompt>\n${userPrompt}\n</developer_prompt>`;
    } else {
      systemInstructions = `You are an AI programming copilot. Assist with ${classification.primaryIntent} tasks.`;
      compiledPrompt = `### CODEBASE CONTEXT\n${contextBlock}\n\n### DEVELOPER INSTRUCTION\n${userPrompt}`;
    }

    const estimatedTokens = Math.ceil((compiledPrompt.length + systemInstructions.length) / 4);

    if (this.eventBus) {
      this.eventBus.emit('prompt:compiled', {
        providerId: options.providerId,
        estimatedTokens,
        tokensSaved: saved,
      });
    }

    return {
      providerId: options.providerId,
      prompt: compiledPrompt,
      systemInstructions: systemInstructions || undefined,
      estimatedTokens,
    };
  }
}
