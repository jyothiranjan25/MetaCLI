/**
 * MetaCLI Core — Markdown Skill Parser
 * 
 * Parses human-friendly SKILL.md Markdown files with YAML frontmatter
 * into fully compliant SkillDefinitions.
 */

import type { SkillDefinition, RetrievalStrategy } from './SkillRegistry.js';

export class MarkdownSkillParser {
  /**
   * Parse a raw Markdown file string into a SkillDefinition.
   */
  public static parse(content: string, defaultId: string): SkillDefinition {
    const lines = content.split(/\r?\n/);
    let inFrontmatter = false;
    const frontmatterLines: string[] = [];
    const bodyLines: string[] = [];

    for (const line of lines) {
      if (line.trim() === '---') {
        inFrontmatter = !inFrontmatter;
        continue;
      }

      if (inFrontmatter) {
        frontmatterLines.push(line);
      } else {
        bodyLines.push(line);
      }
    }

    const metadata = this.parseYaml(frontmatterLines.join('\n'));
    const systemPromptModifier = bodyLines.join('\n').trim();

    const id = (metadata.id || defaultId).trim();
    const name = (metadata.name || id).trim();
    const description = (metadata.description || `Custom parsed skill ${id}`).trim();
    const version = (metadata.version || '1.0.0').trim();
    
    // Categories list parse
    let categories: string[] = ['custom'];
    if (metadata.categories) {
      categories = this.parseList(metadata.categories);
    }

    // Preferred providers list parse
    let preferredProviders: string[] = [];
    if (metadata.preferredProviders) {
      preferredProviders = this.parseList(metadata.preferredProviders);
    }

    // Retrieval strategy mapping
    let retrievalStrategy: RetrievalStrategy = 'focused';
    const rawStrategy = String(metadata.retrievalStrategy || '').toLowerCase();
    if (['broad', 'focused', 'graph-only', 'memory-only'].includes(rawStrategy)) {
      retrievalStrategy = rawStrategy as RetrievalStrategy;
    }

    // Required MCP server list parse
    let requiredMCP: string[] = [];
    if (metadata.requiredMCP) {
      requiredMCP = this.parseList(metadata.requiredMCP);
    }

    return {
      id,
      name,
      description,
      version,
      categories,
      preferredProviders,
      retrievalStrategy,
      memoryNamespace: `skill:${id}`,
      systemPromptModifier: systemPromptModifier || undefined,
      requiredMCP: requiredMCP.length > 0 ? requiredMCP : undefined,
      builtin: false,
    };
  }

  /**
   * Extremely simple and robust key-value YAML parser for basic metadata blocks.
   */
  private static parseYaml(yamlStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = yamlStr.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      result[key] = value;
    }

    return result;
  }

  /**
   * Parses standard inline YAML lists e.g. [vcs, quality] or raw strings.
   */
  private static parseList(val: string): string[] {
    const cleaned = val.trim();
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      return cleaned
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [cleaned].filter(Boolean);
  }
}
