/**
 * MetaCLI Core — Engineering Explainability Runtime
 *
 * Append-only decision audit trail. Auto-captures routing, retrieval,
 * context, and workflow decisions via EventBus listeners. Synthesises
 * human-readable explanations on demand for the /explain command.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface DecisionTrace {
  id: string;
  timestamp: number;
  subsystem: 'router' | 'retrieval' | 'memory' | 'security' | 'workflow' | 'context';
  decision: string;
  rationale: string;
  alternativesConsidered: string[];
  metadata?: Record<string, unknown>;
}

export interface ExplainReport {
  tracesExamined: number;
  summary: string;
  recentDecisions: Array<{ subsystem: string; decision: string; rationale: string }>;
  dominantSubsystem: string;
}

export class EngineeringExplainabilityRuntime {
  private readonly traces: DecisionTrace[] = [];
  private readonly MAX_TRACES = 1000;

  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {
    if (this.__eventBus) this.bindListeners();
  }

  private bindListeners(): void {
    const bus = this.__eventBus!;

    bus.on('provider:healthy', ({ adapterId, score }) => {
      this.logDecision({
        subsystem: 'router',
        decision: `Selected provider ${adapterId}`,
        rationale: `Health score: ${score.toFixed(1)}`,
        alternativesConsidered: [],
      });
    });

    bus.on('retrieval.completed', ({ query, fileCount, latencyMs }) => {
      this.logDecision({
        subsystem: 'retrieval',
        decision: `Retrieved ${fileCount} context files`,
        rationale: `Query: "${query}" — ${latencyMs}ms`,
        alternativesConsidered: [],
      });
    });

    bus.on('context.optimized', ({ providerId, tokensSaved }) => {
      this.logDecision({
        subsystem: 'context',
        decision: `Optimized context window for ${providerId}`,
        rationale: `Saved ${tokensSaved} tokens to fit provider tolerance`,
        alternativesConsidered: ['full context injection', 'aggressive summarization'],
      });
    });

    bus.on('workflow:step_start', ({ workflowId, stepId, provider }) => {
      this.logDecision({
        subsystem: 'workflow',
        decision: `Assigned step "${stepId}" to ${provider}`,
        rationale: `Workflow ${workflowId}: provider matched by task-type strength profile`,
        alternativesConsidered: [],
      });
    });

    bus.on('brain:memory_updated', ({ tier, entriesChanged }) => {
      this.logDecision({
        subsystem: 'memory',
        decision: `Updated ${entriesChanged} entries in ${tier} memory tier`,
        rationale: 'New session context persisted to brain store',
        alternativesConsidered: [],
      });
    });
  }

  public logDecision(trace: Omit<DecisionTrace, 'id' | 'timestamp'>): void {
    const full: DecisionTrace = {
      ...trace,
      id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    this.traces.push(full);
    if (this.traces.length > this.MAX_TRACES) this.traces.shift();
  }

  public explainLastAction(): string {
    if (this.traces.length === 0) return 'No orchestration decisions recorded yet.';

    return this.traces
      .slice(-5)
      .map(t => {
        const alts = t.alternativesConsidered.length > 0
          ? `\n  Alternatives: ${t.alternativesConsidered.join(', ')}`
          : '';
        return `[${t.subsystem.toUpperCase()}] ${t.decision}\n  Why: ${t.rationale}${alts}`;
      })
      .join('\n\n');
  }

  public generateReport(): ExplainReport {
    if (this.traces.length === 0) {
      return { tracesExamined: 0, summary: 'No decisions recorded.', recentDecisions: [], dominantSubsystem: 'none' };
    }

    const counts = new Map<string, number>();
    for (const t of this.traces) counts.set(t.subsystem, (counts.get(t.subsystem) ?? 0) + 1);

    let dominant = 'router';
    let maxCount = 0;
    for (const [sub, count] of counts) {
      if (count > maxCount) { maxCount = count; dominant = sub; }
    }

    const last = this.traces[this.traces.length - 1];

    return {
      tracesExamined: this.traces.length,
      summary: `${this.traces.length} decisions recorded. Dominant: ${dominant} (${maxCount}). Last: "${last?.decision ?? 'none'}"`,
      recentDecisions: this.traces.slice(-10).map(t => ({
        subsystem: t.subsystem,
        decision: t.decision,
        rationale: t.rationale,
      })),
      dominantSubsystem: dominant,
    };
  }

  public getTracesForSubsystem(subsystem: DecisionTrace['subsystem']): DecisionTrace[] {
    return this.traces.filter(t => t.subsystem === subsystem);
  }

  public clear(): void {
    this.traces.length = 0;
  }
}
