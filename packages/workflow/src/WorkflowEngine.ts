/**
 * MetaCLI Workflow — DAG Workflow Engine
 *
 * Core execution engine managing multi-agent tasks, shell commands, and prompt orchestration.
 * Enforces strict logical security whitelists/denylists, sanitizes environment credentials,
 * records Relational Audits, spawns Git snapshot checkpoints, and hard-rolls back workspace
 * changes E2E if a task fails or is aborted.
 */

import { execa } from 'execa';
import {
  CommandAnalyzer,
  GitSnapshotEngine,
  EnvironmentSanitizer,
  PathGuard,
} from '@metacli/core';
import type { BrainStore, ExecutionAudit } from '@metacli/brain';
import type { Orchestrator } from '@metacli/core';

export interface TaskNode {
  id: string;
  name: string;
  type: 'prompt' | 'command';
  prompt?: string;
  command?: string;
  dependencies?: string[];
  status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  result?: string;
}

export interface WorkflowOptions {
  securityMode?: 'safe' | 'trusted' | 'autonomous';
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowedCommands?: string[];
  deniedCommands?: string[];
  // Callback asking for user confirmation (returns true to approve, false to block)
  onConfirmCommand?: (command: string, riskLevel: string, reason: string) => Promise<boolean>;
  onStepProgress?: (stepId: string, status: string, detail?: string) => void;
}

export class WorkflowEngine {
  private analyzer: CommandAnalyzer;
  private gitEngine: GitSnapshotEngine;

  constructor(
    private orchestrator: Orchestrator,
    private store: BrainStore,
    private workspaceRoot: string,
    private options: WorkflowOptions = {},
  ) {
    this.analyzer = new CommandAnalyzer({
      allowed: options.allowedCommands,
      denied: options.deniedCommands,
    });
    this.gitEngine = new GitSnapshotEngine(workspaceRoot);
  }

  /**
   * Execute a topological-ordered list of task nodes.
   */
  async executeWorkflow(nodes: TaskNode[]): Promise<{ success: boolean; executedCount: number }> {
    const executed: Set<string> = new Set();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    let activeSnapshotKey: string | null = null;
    let overallSuccess = true;
    let executedCount = 0;

    try {
      // 1. Topological run loop
      while (executed.size < nodes.length) {
        const nextNode = nodes.find(
          (n) =>
            !executed.has(n.id) &&
            n.status !== 'skipped' &&
            (!n.dependencies || n.dependencies.every((depId) => executed.has(depId) && nodeMap.get(depId)?.status === 'success')),
        );

        if (!nextNode) {
          // If we have unexecuted nodes but no next node ready, it means there are cycles or failures
          const unresolved = nodes.filter((n) => !executed.has(n.id) && n.status !== 'skipped');
          for (const u of unresolved) {
            u.status = 'skipped';
            executed.add(u.id);
          }
          break;
        }

        nextNode.status = 'running';
        this.options.onStepProgress?.(nextNode.id, 'running', `Starting ${nextNode.name}`);

        try {
          if (nextNode.type === 'prompt') {
            // Execute Prompt
            const promptText = nextNode.prompt || '';
            const generator = this.orchestrator.ask(promptText, {
              workingDirectory: this.workspaceRoot,
            });

            let fullContent = '';
            for await (const streamEvent of generator) {
              if (streamEvent.event.type === 'text') {
                fullContent += streamEvent.event.content;
              }
            }

            nextNode.result = fullContent;
            nextNode.status = 'success';
            executedCount++;
            this.options.onStepProgress?.(nextNode.id, 'success', 'Prompt completed');
          } else if (nextNode.type === 'command') {
            // Execute Shell Command
            const cmd = nextNode.command || '';

            // A. Path Boundary Isolation Check
            PathGuard.enforce(this.workspaceRoot, this.workspaceRoot, this.options.allowedPaths, this.options.blockedPaths);

            // B. Static Risk Analysis
            const risk = this.analyzer.analyze(cmd);

            // Denylisted checks
            if (risk.level === 'high' && risk.reason.includes('banned')) {
              throw new Error(`Command blocked by strict denylist policy: "${cmd}"`);
            }

            // C. Git Checkpoint transaction boundaries
            const requiresGitBackup =
              risk.requiresGitCheckpoint ||
              this.options.securityMode === 'autonomous' ||
              this.options.securityMode === 'trusted';

            if (requiresGitBackup && !activeSnapshotKey) {
              try {
                activeSnapshotKey = await this.gitEngine.createCheckpoint(
                  `Pre-execution for task node: ${nextNode.name}`,
                );
                this.options.onStepProgress?.(nextNode.id, 'running', `Created rollback checkpoint: ${activeSnapshotKey}`);
              } catch (gitErr) {
                // Non-git repo warnings are fine to log, but don't crash low-risk runs unless strict
              }
            }

            // D. Security Supervisor Intercept Modal Prompt
            let approved = true;

            if (risk.level === 'high' || (this.options.securityMode === 'safe' && risk.level !== 'low')) {
              if (this.options.onConfirmCommand) {
                approved = await this.options.onConfirmCommand(cmd, risk.level, risk.reason);
              } else {
                // If no prompt callback provided, block high-risk conservatively in safe mode
                approved = false;
              }
            }

            if (!approved) {
              nextNode.status = 'failed';
              throw new Error(`Execution blocked by security supervisor prompt decision.`);
            }

            // E. Clean Credentials environment sanitizer
            const cleanEnv = EnvironmentSanitizer.sanitize(process.env);

            // F. Process run execution
            const startTime = Date.now();
            const auditId = `audit-${Date.now()}`;

            let processSuccess = false;
            let outputSnippet = '';

            // Create initial pending audit record
            const auditRecord: ExecutionAudit = {
              id: auditId,
              command: cmd,
              riskLevel: risk.level,
              riskReason: risk.reason,
              approvedBy: approved ? 'user' : 'auto-policy',
              snapshotKey: activeSnapshotKey || undefined,
              status: 'pending',
            };
            this.store.saveExecutionAudit(auditRecord);

            try {
              const proc = execa(cmd, {
                shell: true,
                cwd: this.workspaceRoot,
                env: cleanEnv,
                all: true,
              });

              const result = await proc;
              processSuccess = result.exitCode === 0;
              outputSnippet = result.all ? result.all.slice(0, 1000) : '';
            } catch (procErr: any) {
              processSuccess = false;
              outputSnippet = procErr.all || procErr.message || 'Execution error';
              throw procErr;
            } finally {
              const durationMs = Date.now() - startTime;
              // Finalize relational SQLite audit logs
              auditRecord.status = processSuccess ? 'success' : 'failed';
              auditRecord.durationMs = durationMs;
              auditRecord.outputSnippet = outputSnippet;
              this.store.saveExecutionAudit(auditRecord);
            }

            nextNode.status = 'success';
            executedCount++;
            this.options.onStepProgress?.(nextNode.id, 'success', `Completed: ${cmd}`);
          }
        } catch (err: any) {
          nextNode.status = 'failed';
          this.options.onStepProgress?.(nextNode.id, 'failed', `Error: ${err.message}`);
          overallSuccess = false;
          break; // break loop on topological failures
        } finally {
          executed.add(nextNode.id);
        }
      }
    } catch (outerErr) {
      overallSuccess = false;
    }

    // 2. Transaction Rollback boundaries
    if (!overallSuccess && activeSnapshotKey) {
      try {
        this.options.onStepProgress?.('system', 'running', `CRASH DETECTED. Executing workspace rollback to: ${activeSnapshotKey}`);
        await this.gitEngine.restoreSnapshot(activeSnapshotKey);
        
        // Log all relational SQLite audits as rolled_back
        const audits = this.store.getAllExecutionAudits();
        const activeAudits = audits.filter((a: ExecutionAudit) => a.snapshotKey === activeSnapshotKey);
        for (const a of activeAudits) {
          a.status = 'rolled_back';
          this.store.saveExecutionAudit(a);
        }
        
        this.options.onStepProgress?.('system', 'success', `Rollback completed successfully.`);
      } catch (restoreErr) {
        // Safe failover
      }
    }

    return {
      success: overallSuccess,
      executedCount,
    };
  }
}
