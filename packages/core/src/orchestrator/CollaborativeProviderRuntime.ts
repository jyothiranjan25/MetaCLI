/**
 * MetaCLI Core — Collaborative Provider Runtime
 *
 * Orchestrates multi-provider distributed execution DAGs where each
 * provider acts as a specialized worker: architect, implementer,
 * reviewer, or tester. Tasks share a context pipeline; upstream
 * results are injected into downstream prompts automatically.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import { ProviderExecutionProfiles } from './ProviderExecutionProfiles.js';

export interface CollaborativeTask {
  id: string;
  type: 'design' | 'implement' | 'review' | 'test';
  prompt: string;
  dependencies: string[];
  assignedProvider?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface WorkflowContext {
  workflowId: string;
  sharedMemory: Record<string, string>;
  startedAt: number;
}

export interface CollaborativeResult {
  workflowId: string;
  tasks: CollaborativeTask[];
  sharedMemory: Record<string, string>;
  durationMs: number;
  completedCount: number;
  failedCount: number;
}

export type TaskExecutorFn = (
  task: CollaborativeTask,
  context: WorkflowContext,
) => Promise<string>;

export class CollaborativeProviderRuntime {
  private tasks = new Map<string, CollaborativeTask>();
  private executor: TaskExecutorFn | null = null;

  constructor(
    private readonly profiles: ProviderExecutionProfiles,
    private readonly __eventBus: EventBus<MetaCLIEvents>,
  ) {}

  public registerExecutor(fn: TaskExecutorFn): void {
    this.executor = fn;
  }

  public async runWorkflow(
    workflowId: string,
    tasks: CollaborativeTask[],
  ): Promise<CollaborativeResult> {
    this.tasks.clear();
    const context: WorkflowContext = {
      workflowId,
      sharedMemory: {},
      startedAt: Date.now(),
    };

    for (const task of tasks) {
      task.assignedProvider = this.assignProvider(task);
      task.status = 'pending';
      this.tasks.set(task.id, task);
    }

    await this.__eventBus.emit('workflow:start', {
      workflowId,
      name: 'collaborative-provider-workflow',
      stepCount: tasks.length,
    });

    await this.drainDAG(context);

    const allTasks = [...this.tasks.values()];
    const completedCount = allTasks.filter(t => t.status === 'completed').length;
    const failedCount = allTasks.filter(t => t.status === 'failed').length;
    const durationMs = Date.now() - context.startedAt;

    await this.__eventBus.emit('workflow:complete', { workflowId, durationMs });

    return {
      workflowId,
      tasks: allTasks,
      sharedMemory: context.sharedMemory,
      durationMs,
      completedCount,
      failedCount,
    };
  }

  public getTaskStatus(taskId: string): CollaborativeTask | undefined {
    return this.tasks.get(taskId);
  }

  // ─── Private ─────────────────────────────────────────────────────

  private assignProvider(task: CollaborativeTask): string {
    const roleMap: Record<CollaborativeTask['type'], 'architect' | 'implementer' | 'reviewer' | 'tester'> = {
      design: 'architect',
      implement: 'implementer',
      review: 'reviewer',
      test: 'tester',
    };
    return this.profiles.getOptimalProviderForRole(roleMap[task.type])?.id ?? 'claude';
  }

  private async drainDAG(context: WorkflowContext): Promise<void> {
    let progressed = true;

    while (progressed) {
      progressed = false;

      const ready = [...this.tasks.values()].filter(
        t => t.status === 'pending' &&
          t.dependencies.every(d => this.tasks.get(d)?.status === 'completed'),
      );

      if (ready.length === 0) break;

      await Promise.all(ready.map(t => this.executeTask(t, context)));
      progressed = true;
    }
  }

  private async executeTask(task: CollaborativeTask, context: WorkflowContext): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();

    await this.__eventBus.emit('workflow:step_start', {
      workflowId: context.workflowId,
      stepId: task.id,
      provider: task.assignedProvider ?? 'unknown',
    });

    try {
      const enrichedPrompt = this.buildEnrichedPrompt(task, context);
      const result = this.executor
        ? await this.executor({ ...task, prompt: enrichedPrompt }, context)
        : `[stub] ${task.assignedProvider} result for task ${task.id}`;

      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      context.sharedMemory[task.id] = result;

      await this.__eventBus.emit('workflow:step_complete', {
        workflowId: context.workflowId,
        stepId: task.id,
        durationMs: task.completedAt - (task.startedAt ?? task.completedAt),
      });
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);

      await this.__eventBus.emit('workflow:error', {
        workflowId: context.workflowId,
        stepId: task.id,
        error: task.error,
      });
    }
  }

  private buildEnrichedPrompt(task: CollaborativeTask, context: WorkflowContext): string {
    const upstream = task.dependencies
      .map(id => context.sharedMemory[id])
      .filter(Boolean)
      .join('\n\n---\n\n');

    return upstream
      ? `${task.prompt}\n\n## Prior Stage Output\n\n${upstream}`
      : task.prompt;
  }
}
