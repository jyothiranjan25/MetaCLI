/**
 * MetaCLI Core — Skill-Aware Prompt Compiler
 *
 * Injects the active-skill context (system modifier, MCP tool descriptions,
 * memory excerpts) into the compiled prompt so providers receive skill-native
 * instructions without the caller knowing skill details.
 */

import type { SkillRuntime } from './SkillRuntime.js';
import type { SkillMemoryManager } from './SkillMemoryManager.js';

export interface SkillEnrichedPrompt {
  systemModifier: string;
  memoryContext: string;
  mcpToolsContext: string;
  /** Total estimated tokens for the skill injection */
  estimatedInjectionTokens: number;
}

export class SkillAwarePromptCompiler {
  constructor(
    private readonly skillRuntime: SkillRuntime,
    private readonly memoryManager: SkillMemoryManager,
  ) {}

  public compile(userIntent: string): SkillEnrichedPrompt {
    const ctx = this.skillRuntime.getActiveContext();

    // Build system modifier from all active skills
    const systemModifier = ctx.combinedSystemModifier;

    // Pull recent memories from all active skill namespaces
    const memoryExcerpts: string[] = [];
    for (const ns of ctx.memoryNamespaces) {
      const memories = this.memoryManager.query({
        namespace: ns,
        keywords: userIntent.split(/\s+/).filter(w => w.length > 3),
        minConfidence: 0.7,
        maxResults: 3,
      });
      for (const m of memories) {
        memoryExcerpts.push(`[${ns}] ${m.content}`);
      }
    }

    const memoryContext = memoryExcerpts.length > 0
      ? `## Skill Memory\n${memoryExcerpts.join('\n')}`
      : '';

    // Describe available MCP tools for provider awareness
    const mcpToolsContext = ctx.requiredMCPServers.length > 0
      ? `## Available MCP Tools\n${ctx.requiredMCPServers.map(id => `- ${id}`).join('\n')}`
      : '';

    const injectionText = [systemModifier, memoryContext, mcpToolsContext].filter(Boolean).join('\n\n');
    const estimatedInjectionTokens = Math.ceil(injectionText.length / 4);

    return { systemModifier, memoryContext, mcpToolsContext, estimatedInjectionTokens };
  }
}
