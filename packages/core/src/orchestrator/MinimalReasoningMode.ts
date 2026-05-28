/**
 * MetaCLI Core — Minimal Reasoning Mode
 *
 * Classifies each task by complexity and returns the appropriate reasoning
 * strategy. Trivial tasks (renames, typos, local patches) get a shallow
 * single-pass execution — no multi-agent orchestration, no deep graph
 * traversal, no expensive provider calls.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export type ReasoningDepth = 'trivial' | 'simple' | 'moderate' | 'complex';

export interface TaskClassification {
  depth: ReasoningDepth;
  reason: string;
  allowMultiProvider: boolean;
  maxContextFiles: number;
  maxRetrievalDepth: number;
  useGraphTraversal: boolean;
  estimatedTokens: number;
}

const DEPTH_BUDGETS: Record<ReasoningDepth, Omit<TaskClassification, 'depth' | 'reason'>> = {
  trivial:  { allowMultiProvider: false, maxContextFiles: 1,   maxRetrievalDepth: 0, useGraphTraversal: false, estimatedTokens: 500   },
  simple:   { allowMultiProvider: false, maxContextFiles: 3,   maxRetrievalDepth: 1, useGraphTraversal: false, estimatedTokens: 2_000 },
  moderate: { allowMultiProvider: false, maxContextFiles: 8,   maxRetrievalDepth: 2, useGraphTraversal: true,  estimatedTokens: 8_000 },
  complex:  { allowMultiProvider: true,  maxContextFiles: 20,  maxRetrievalDepth: 4, useGraphTraversal: true,  estimatedTokens: 40_000 },
};

// Patterns that signal trivial work
const TRIVIAL_PATTERNS = [
  /^rename\b/i, /^fix typo/i, /^update comment/i, /^change variable/i,
  /^add missing/i, /^remove unused/i, /^fix import/i, /^bump version/i,
];

const COMPLEX_PATTERNS = [
  /\barchitecture\b/i, /\brefactor\b/i, /\bmigrat/i, /\bdesign\b/i,
  /\bsystem\b/i, /\bintegrat/i, /\bperformance\b/i, /\bsecurity audit\b/i,
  /\bmulti.file\b/i, /\bbreaking change\b/i,
];

export class MinimalReasoningMode {
  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {}

  public classify(prompt: string, affectedFileCount = 1): TaskClassification {
    const depth = this.inferDepth(prompt, affectedFileCount);
    const budget = DEPTH_BUDGETS[depth];
    const reason = this.describeReason(depth, prompt, affectedFileCount);

    this.__eventBus?.emit('intent.detected' as any, {
      prompt: prompt.slice(0, 100),
      intent: depth,
      confidence: 0.8,
    });

    return { depth, reason, ...budget };
  }

  /**
   * Given a classification, return a system-prompt modifier that biases the
   * provider toward the appropriate reasoning depth.
   */
  public toPromptModifier(classification: TaskClassification): string {
    switch (classification.depth) {
      case 'trivial':
        return 'This is a trivial local change. Respond directly with the minimal edit. No explanation needed.';
      case 'simple':
        return 'This is a straightforward task. Apply the change with brief reasoning.';
      case 'moderate':
        return 'This task requires careful consideration of affected dependencies.';
      case 'complex':
        return 'This is a complex engineering task requiring architectural reasoning and impact analysis.';
    }
  }

  // ─── Private ─────────────────────────────────────────────────────

  private inferDepth(prompt: string, fileCount: number): ReasoningDepth {
    if (TRIVIAL_PATTERNS.some(p => p.test(prompt)) && fileCount === 1) return 'trivial';
    if (COMPLEX_PATTERNS.some(p => p.test(prompt)) || fileCount > 10) return 'complex';
    if (fileCount > 4 || prompt.length > 400) return 'moderate';
    if (fileCount > 1 || prompt.length > 100) return 'simple';
    return 'trivial';
  }

  private describeReason(depth: ReasoningDepth, prompt: string, fileCount: number): string {
    if (depth === 'trivial') return 'Matched trivial-change pattern with single-file scope';
    if (depth === 'complex') return `Complex intent detected or high file count (${fileCount})`;
    return `${fileCount} file(s), prompt length ${prompt.length} — ${depth} scope`;
  }
}
