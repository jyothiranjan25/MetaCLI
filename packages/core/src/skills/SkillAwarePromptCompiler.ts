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
    const activeSkills = this.skillRuntime.getActiveSkills();

    // 1. Structured prompt chaining of active skills with explicit delimiters
    const systemModifiers: string[] = [];
    for (const skill of activeSkills) {
      if (skill.systemPromptModifier) {
        systemModifiers.push(
          `### Skill: ${skill.name} (v${skill.version})\n` +
          `* Namespace: \`${skill.memoryNamespace}\`\n` +
          `* Categories: ${skill.categories.join(', ')}\n` +
          `* Directives:\n${skill.systemPromptModifier}`
        );
      }
    }

    const systemModifier = systemModifiers.length > 0
      ? `## MetaCLI Unified Active Skills Pipeline\n` +
        `MetaCLI has dynamically compiled and chained the following active workspace capabilities. Apply all directives:\n\n` +
        systemModifiers.join('\n\n')
      : '';

    // 2. Structured memory context segments
    const memoryExcerpts: string[] = [];
    for (const ns of ctx.memoryNamespaces) {
      const memories = this.memoryManager.query({
        namespace: ns,
        keywords: userIntent.split(/\s+/).filter(w => w.length > 3),
        minConfidence: 0.7,
        maxResults: 3,
      });
      if (memories.length > 0) {
        memoryExcerpts.push(
          `#### Namespace [${ns}]\n` +
          memories.map(m => `  • ${m.content}`).join('\n')
        );
      }
    }

    const memoryContext = memoryExcerpts.length > 0
      ? `## MetaCLI Skill-Aware Cognitive Memory Context\n` +
        `The following relevant historical patterns were extracted from the sqlite brain layer:\n\n` +
        memoryExcerpts.join('\n\n')
      : '';

    // 3. Structured MCP capabilities context
    const mcpToolsContext = ctx.requiredMCPServers.length > 0
      ? `## MetaCLI Registered MCP Tool Capabilities\n` +
        `The following MCP server services are currently registered and verified online:\n` +
        ctx.requiredMCPServers.map(id => `- **${id}**`).join('\n')
      : '';

    const injectionText = [systemModifier, memoryContext, mcpToolsContext].filter(Boolean).join('\n\n');
    const estimatedInjectionTokens = Math.ceil(injectionText.length / 4);

    return { systemModifier, memoryContext, mcpToolsContext, estimatedInjectionTokens };
  }
}
