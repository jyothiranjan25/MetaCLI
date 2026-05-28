import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { GitSnapshotEngine } from './GitSnapshotEngine.js';

const execAsync = promisify(exec);

describe('GitSnapshotEngine', () => {
  const tempGitDir = path.resolve('./temp-git-test');
  let engine: GitSnapshotEngine;

  beforeEach(async () => {
    if (fs.existsSync(tempGitDir)) {
      fs.rmSync(tempGitDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempGitDir, { recursive: true });
    engine = new GitSnapshotEngine(tempGitDir);

    // Initialize temporary Git repository
    await execAsync('git init -b main', { cwd: tempGitDir });
    await execAsync('git config user.name "MetaCLI Test"', { cwd: tempGitDir });
    await execAsync('git config user.email "test@metacli.ai"', { cwd: tempGitDir });

    // Initial commit
    fs.writeFileSync(path.join(tempGitDir, 'readme.md'), '# MetaCLI Workspace');
    await execAsync('git add readme.md', { cwd: tempGitDir });
    await execAsync('git commit -m "initial commit"', { cwd: tempGitDir });
  });

  afterEach(async () => {
    if (fs.existsSync(tempGitDir)) {
      fs.rmSync(tempGitDir, { recursive: true, force: true });
    }
  });

  it('should prevent checkpoints in non-git directories', async () => {
    const nonGitDir = path.resolve('./temp-non-git');
    if (fs.existsSync(nonGitDir)) fs.rmSync(nonGitDir, { recursive: true });
    fs.mkdirSync(nonGitDir);

    const badEngine = new GitSnapshotEngine(nonGitDir);
    await expect(badEngine.createCheckpoint('fail')).rejects.toThrow('not an active Git workspace');

    fs.rmSync(nonGitDir, { recursive: true });
  });

  it('should successfully create a snapshot checkpoint branch and rollback dirty changes', async () => {
    // 1. Write some initial files
    fs.writeFileSync(path.join(tempGitDir, 'index.ts'), 'console.log("hello");');
    await execAsync('git add index.ts', { cwd: tempGitDir });
    await execAsync('git commit -m "add index.ts"', { cwd: tempGitDir });

    // 2. Introduce dirty modifications and new untracked files
    fs.writeFileSync(path.join(tempGitDir, 'index.ts'), 'console.log("dirty edit");');
    fs.writeFileSync(path.join(tempGitDir, 'secret.txt'), 'private key data');

    // 3. Trigger snapshot checkpoint
    const snapshotKey = await engine.createCheckpoint('testing rollback safety');
    expect(snapshotKey).toContain('metacli-backup-');

    // 4. Do more destructive writes and deletions (simulating failing AI execution)
    fs.writeFileSync(path.join(tempGitDir, 'index.ts'), 'broken code...');
    fs.unlinkSync(path.join(tempGitDir, 'readme.md')); // delete a file
    fs.writeFileSync(path.join(tempGitDir, 'unwanted.tmp'), 'junk');

    // Verify index was broken and readme is gone
    expect(fs.readFileSync(path.join(tempGitDir, 'index.ts'), 'utf-8')).toBe('broken code...');
    expect(fs.existsSync(path.join(tempGitDir, 'readme.md'))).toBe(false);

    // 5. Restore snapshot (roll back to checkpoints)
    await engine.restoreSnapshot(snapshotKey);

    // 6. Validate E2E state is perfectly restored!
    expect(fs.readFileSync(path.join(tempGitDir, 'index.ts'), 'utf-8')).toBe('console.log("dirty edit");');
    expect(fs.existsSync(path.join(tempGitDir, 'readme.md'))).toBe(true); // file restored!
    expect(fs.readFileSync(path.join(tempGitDir, 'secret.txt'), 'utf-8')).toBe('private key data'); // untracked restored!
    expect(fs.existsSync(path.join(tempGitDir, 'unwanted.tmp'))).toBe(false); // temp deleted!
  });
});
