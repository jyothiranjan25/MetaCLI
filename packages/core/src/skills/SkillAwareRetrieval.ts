/**
 * MetaCLI Core — Skill-Aware Retrieval
 *
 * Adapts the retrieval strategy to the active skill set.  A Jira skill biases
 * toward memory-only (no raw file reads); a Postgres skill narrows to schema
 * files; a Docker skill targets Dockerfile + compose paths.
 */

import type { SkillRuntime } from './SkillRuntime.js';
import type { RetrievalStrategy } from './SkillRegistry.js';

export interface SkillAwareRetrievalHints {
  strategy: RetrievalStrategy;
  filePathFilters: string[];   // glob patterns to prefer
  memoryNamespaces: string[];  // namespaces to query first
  maxContextFiles: number;
  prioritiseMemory: boolean;
}

export class SkillAwareRetrieval {
  constructor(private readonly skillRuntime: SkillRuntime) {}

  public getRetrievalHints(intent: string): SkillAwareRetrievalHints {
    const activeSkills = this.skillRuntime.getActiveSkills();

    if (activeSkills.length === 0) {
      return this.defaultHints();
    }

    // Merge strategies: most restrictive wins
    const strategies = activeSkills.map(s => s.retrievalStrategy);
    const strategy = this.mergeStrategies(strategies);

    // Collect file path filters from skill categories
    const filePathFilters = this.inferFileFilters(activeSkills.map(s => s.categories).flat(), intent);
    const memoryNamespaces = activeSkills.map(s => s.memoryNamespace);
    const prioritiseMemory = strategy === 'memory-only';
    const maxContextFiles = strategy === 'focused' ? 5 : strategy === 'graph-only' ? 0 : 15;

    return { strategy, filePathFilters, memoryNamespaces, maxContextFiles, prioritiseMemory };
  }

  // ─── Private ─────────────────────────────────────────────────────

  private defaultHints(): SkillAwareRetrievalHints {
    return {
      strategy: 'broad',
      filePathFilters: [],
      memoryNamespaces: [],
      maxContextFiles: 10,
      prioritiseMemory: false,
    };
  }

  private mergeStrategies(strategies: RetrievalStrategy[]): RetrievalStrategy {
    if (strategies.includes('memory-only')) return 'memory-only';
    if (strategies.includes('graph-only'))  return 'graph-only';
    if (strategies.includes('focused'))     return 'focused';
    return 'broad';
  }

  private inferFileFilters(categories: string[], intent: string): string[] {
    const filters: string[] = [];
    const lower = intent.toLowerCase();

    if (categories.includes('database') || lower.includes('schema') || lower.includes('migration')) {
      filters.push('**/*.sql', '**/migrations/**', '**/schema*');
    }
    if (categories.includes('infrastructure') || lower.includes('docker') || lower.includes('kubernetes')) {
      filters.push('**/Dockerfile*', '**/docker-compose*', '**/*.yaml', '**/*.yml');
    }
    if (categories.includes('vcs') || lower.includes('github') || lower.includes('git')) {
      filters.push('**/.github/**', '**/CODEOWNERS');
    }

    return filters;
  }
}
