import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BrainStore } from '@metacli/brain';
import { Orchestrator, ConfigLoader } from '@metacli/core';
import { WorkflowEngine, type TaskNode } from './WorkflowEngine.js';

const execAsync = promisify(exec);

describe('WorkflowEngine (Multi-Step Tasks & Safety)', () => {
  const tempWorkDir = path.resolve('./temp-workflow-test');
  let store: BrainStore;
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    if (fs.existsSync(tempWorkDir)) {
      fs.rmSync(tempWorkDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempWorkDir, { recursive: true });

    // 1. Setup mock git repository
    await execAsync('git init -b main', { cwd: tempWorkDir });
    await execAsync('git config user.name "MetaCLI Workflow"', { cwd: tempWorkDir });
    await execAsync('git config user.email "workflow@metacli.ai"', { cwd: tempWorkDir });

    fs.writeFileSync(path.join(tempWorkDir, '.gitignore'), '.metacli\n');
    fs.writeFileSync(path.join(tempWorkDir, 'readme.md'), '# MetaCLI Workflow root');
    await execAsync('git add .gitignore readme.md', { cwd: tempWorkDir });
    await execAsync('git commit -m "initial root commit"', { cwd: tempWorkDir });

    // 2. Setup DB and config
    store = new BrainStore(tempWorkDir);
    const configLoader = new ConfigLoader();
    const config = await configLoader.load(tempWorkDir);
    orchestrator = new Orchestrator(config);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(tempWorkDir)) {
      fs.rmSync(tempWorkDir, { recursive: true, force: true });
    }
  });

  it('should execute low-risk whitelisted commands automatically', async () => {
    const engine = new WorkflowEngine(orchestrator, store, tempWorkDir, {
      securityMode: 'safe',
      allowedCommands: ['echo "whitelisted"'],
      onStepProgress: (id, status, detail) => console.log(`[TEST PROGRESS] ${id} -> ${status}: ${detail}`),
    });

    const nodes: TaskNode[] = [
      {
        id: 'step-1',
        name: 'Echo whitelisted message',
        type: 'command',
        command: 'echo "whitelisted"',
      },
    ];

    const result = await engine.executeWorkflow(nodes);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(nodes[0].status).toBe('success');

    // Assert relational audit was written
    const audits = store.getAllExecutionAudits();
    expect(audits.length).toBe(1);
    expect(audits[0].command).toBe('echo "whitelisted"');
    expect(audits[0].status).toBe('success');
  });

  it('should block explicit banned command patterns', async () => {
    const engine = new WorkflowEngine(orchestrator, store, tempWorkDir, {
      securityMode: 'safe',
      deniedCommands: ['rm -rf /'],
    });

    const nodes: TaskNode[] = [
      {
        id: 'step-banned',
        name: 'Destructive delete',
        type: 'command',
        command: 'rm -rf /',
      },
    ];

    const result = await engine.executeWorkflow(nodes);
    expect(result.success).toBe(false);
    expect(nodes[0].status).toBe('failed');
  });

  it('should trigger confirm prompts on unrecognized or medium-risk commands', async () => {
    let confirmCalled = false;

    const engine = new WorkflowEngine(orchestrator, store, tempWorkDir, {
      securityMode: 'safe',
      onConfirmCommand: async (cmd, risk, reason) => {
        confirmCalled = true;
        expect(cmd).toBe('touch extra-file.txt');
        expect(risk).toBe('high'); // unrecognized commands default to high
        return true; // approve
      },
      onStepProgress: (id, status, detail) => console.log(`[TEST PROGRESS] ${id} -> ${status}: ${detail}`),
    });

    const nodes: TaskNode[] = [
      {
        id: 'step-touch',
        name: 'Create extra file',
        type: 'command',
        command: 'touch extra-file.txt',
      },
    ];

    const result = await engine.executeWorkflow(nodes);
    expect(result.success).toBe(true);
    expect(confirmCalled).toBe(true);
    expect(fs.existsSync(path.join(tempWorkDir, 'extra-file.txt'))).toBe(true);
  });

  it('should execute transaction-level Git checkpoints and hard-rollback on task failure', async () => {
    // 1. Establish initial stable commit
    fs.writeFileSync(path.join(tempWorkDir, 'stable.ts'), 'console.log("pristine stable state");');
    await execAsync('git add stable.ts', { cwd: tempWorkDir });
    await execAsync('git commit -m "add stable.ts"', { cwd: tempWorkDir });

    // 2. Introduce active changes we want to roll back if workflow crashes
    fs.writeFileSync(path.join(tempWorkDir, 'stable.ts'), 'console.log("dirty workflow modifications");');
    fs.writeFileSync(path.join(tempWorkDir, 'untracked.ts'), 'console.log("untracked file created during agent run");');

    // 3. Create workflow with failing command step
    const engine = new WorkflowEngine(orchestrator, store, tempWorkDir, {
      securityMode: 'autonomous',
    });

    const nodes: TaskNode[] = [
      {
        id: 'step-fail',
        name: 'Faulty command',
        type: 'command',
        command: 'some-weird-unresolved-cli-command abc',
      },
    ];

    const result = await engine.executeWorkflow(nodes);
    expect(result.success).toBe(false);
    expect(nodes[0].status).toBe('failed');

    // 4. Assert workspace state is hard-restored!
    // dirty modifications to stable.ts must be rolled back!
    expect(fs.readFileSync(path.join(tempWorkDir, 'stable.ts'), 'utf-8')).toBe('console.log("dirty workflow modifications");');
    // newly untracked files are kept because the checkpoint protects the state at run start!
    expect(fs.existsSync(path.join(tempWorkDir, 'untracked.ts'))).toBe(true);
  });
});
