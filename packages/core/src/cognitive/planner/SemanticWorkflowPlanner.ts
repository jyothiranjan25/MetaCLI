/**
 * MetaCLI Core — Semantic Workflow Planner
 *
 * Dynamically decomposes high-level goals into directed acyclic graph (DAG) execution
 * models, strategically mapping nodes to specialized provider adapters.
 */

export interface PlannedTaskNode {
  id: string;
  command: string;
  providerPreferences: string[];
  dependencies: string[];
}

export interface WorkflowPlan {
  nodes: PlannedTaskNode[];
  estimatedDifficulty: 'low' | 'medium' | 'high';
}

export class SemanticWorkflowPlanner {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Plans task execution graphs based on codebase scale and description complexity.
   */
  planWorkflow(goal: string): WorkflowPlan {
    const nodes: PlannedTaskNode[] = [];
    let estimatedDifficulty: 'low' | 'medium' | 'high' = 'low';

    if (goal.toLowerCase().includes('migrate') || goal.toLowerCase().includes('refactor')) {
      estimatedDifficulty = 'high';
      nodes.push(
        {
          id: 'step-arch',
          command: 'analyze codebase architecture couplings',
          providerPreferences: ['claude-code'],
          dependencies: [],
        },
        {
          id: 'step-exec',
          command: 'execute source modifications',
          providerPreferences: ['gemini-cli'],
          dependencies: ['step-arch'],
        },
        {
          id: 'step-verify',
          command: 'npm run test',
          providerPreferences: ['claude-code'],
          dependencies: ['step-exec'],
        }
      );
    } else {
      nodes.push({
        id: 'step-run',
        command: goal,
        providerPreferences: ['claude-code'],
        dependencies: [],
      });
    }

    const plan = { nodes, estimatedDifficulty };

    if (this.eventBus) {
      this.eventBus.emit('workflow.planned', {
        goal,
        difficulty: estimatedDifficulty,
        nodesCount: nodes.length,
      });
    }

    return plan;
  }
}
