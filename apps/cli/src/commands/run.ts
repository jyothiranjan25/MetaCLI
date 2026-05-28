/**
 * MetaCLI CLI — `run` Command
 *
 * Runs autonomous workflows from a task graph file, enforcing
 * isolation sandboxes, custom whitelists/denylists, and interactive supervisor UI.
 */

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render } from 'ink';
import { bootstrap } from '../bootstrap.js';
import { WorkflowEngine, type TaskNode } from '@metacli/workflow';
import { SecuritySupervisorView } from '../ui/SecuritySupervisorView.js';
import { BrainStore } from '@metacli/brain';

interface RunCommandOptions {
  file?: string;
  dir: string;
  mode?: 'safe' | 'trusted' | 'autonomous';
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  try {
    const { orchestrator, config, eventBus } = await bootstrap(options.dir);

    // 1. Resolve tasks JSON file
    const taskFilePath = options.file
      ? path.resolve(options.dir, options.file)
      : path.join(options.dir, 'metacli-tasks.json');

    let nodes: TaskNode[] = [];

    if (fs.existsSync(taskFilePath)) {
      try {
        nodes = JSON.parse(fs.readFileSync(taskFilePath, 'utf-8'));
      } catch (jsonErr) {
        console.error(`❌ Error parsing tasks JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
        process.exit(1);
      }
    } else {
      // Create a default demonstration task graph if none exists
      console.log(`\n📝 No task graph found at "${taskFilePath}". Generating safe demo tasks...\n`);
      nodes = [
        {
          id: 'task-1',
          name: 'Verify Git workspace status',
          type: 'command',
          command: 'git status',
        },
        {
          id: 'task-2',
          name: 'Run project tests',
          type: 'command',
          command: 'npm test',
          dependencies: ['task-1'],
        },
      ];
      fs.writeFileSync(taskFilePath, JSON.stringify(nodes, null, 2));
    }

    console.log(`⚙◆ Initializing MetaCLI Workflow Engine...`);
    console.log(`• Active Security Mode: ${(options.mode ?? config.security.mode).toUpperCase()}`);
    console.log(`• Workspace Containment: ${options.dir}\n`);

    // 2. Wires Relational database store
    const store = new BrainStore(options.dir);

    // 3. Instantiate WorkflowEngine E2E
    const engine = new WorkflowEngine(orchestrator, store, options.dir, {
      securityMode: options.mode ?? config.security.mode,
      allowedPaths: config.security.allowedPaths,
      blockedPaths: config.security.blockedPaths,
      allowedCommands: config.security.permissions.commands.allow,
      deniedCommands: config.security.permissions.commands.deny,
      onStepProgress: (stepId, status, detail) => {
        if (status === 'running') {
          console.log(`⚙ [RUNNING] Node: ${stepId} — ${detail}`);
        } else if (status === 'success') {
          console.log(`✓ [SUCCESS] Node: ${stepId} — ${detail}`);
        } else if (status === 'failed') {
          console.log(`❌ [FAILED]  Node: ${stepId} — ${detail}`);
        }
      },
      onConfirmCommand: async (cmd, risk, reason) => {
        // Intercept step execution and render the supervisor UI
        return new Promise<boolean>((resolve) => {
          const { unmount } = render(
            React.createElement(SecuritySupervisorView, {
              command: cmd,
              riskLevel: risk,
              riskReason: reason,
              securityMode: options.mode ?? config.security.mode,
              workspaceRoot: options.dir,
              onDecision: (approved, rollback) => {
                setTimeout(() => {
                  unmount();
                  if (rollback) {
                    resolve(false); // Rolback throws abort E2E
                  } else {
                    resolve(approved);
                  }
                }, 800);
              },
            }),
          );
        });
      },
    });

    const outcome = await engine.executeWorkflow(nodes);
    store.close();

    if (outcome.success) {
      console.log(`\n🎉 Workflow completed successfully! Executed ${outcome.executedCount} task nodes.\n`);
    } else {
      console.log(`\n⚠️ Workflow execution failed or aborted. Check snapshots & transaction audits.\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Run Command Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
