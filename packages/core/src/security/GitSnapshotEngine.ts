import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class GitSnapshotEngine {
  constructor(private projectRoot: string) {}

  /**
   * Create a Git checkpoint. Returns a snapshot hash key.
   */
  async createCheckpoint(description: string): Promise<string> {
    const timestamp = Date.now();
    const branchName = `metacli-backup-${timestamp}`;

    try {
      // 1. Verify inside a Git worktree
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.projectRoot });
    } catch {
      throw new Error('Project directory is not an active Git workspace. Checkpoints blocked.');
    }

    try {
      // 2. Fetch current branch name
      const { stdout: currentBranchRaw } = await execAsync('git branch --show-current', { cwd: this.projectRoot });
      const currentBranch = currentBranchRaw.trim();

      if (!currentBranch) {
        throw new Error('Detached HEAD state. Cannot safely spawn automated checkpoints.');
      }

      // 3. Checkout a temporary backup branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: this.projectRoot });

      try {
        // 4. Stash all modifications including untracked files
        await execAsync('git add -A', { cwd: this.projectRoot });
        
        // We will make a commit. If there are no changes, it will fail, which is fine to catch.
        try {
          await execAsync(`git commit -m "MetaCLI Checkpoint: ${description}" --no-verify`, { cwd: this.projectRoot });
        } catch {
          // No changes to commit, commit is skipped
        }

        // Get the commit hash
        const { stdout: hashRaw } = await execAsync('git rev-parse HEAD', { cwd: this.projectRoot });
        const commitHash = hashRaw.trim();

        // 5. Checkout the user's initial branch back
        await execAsync(`git checkout ${currentBranch}`, { cwd: this.projectRoot });

        return `${branchName}:${commitHash}`;
      } catch (innerError) {
        // Clean up: return to user's branch
        await execAsync(`git checkout ${currentBranch}`, { cwd: this.projectRoot });
        throw innerError;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Git snapshot checkpoint: ${msg}`);
    }
  }

  /**
   * Rollback the workspace back to a snapshot commit.
   */
  async restoreSnapshot(snapshotKey: string): Promise<void> {
    const [backupBranch, commitHash] = snapshotKey.split(':');
    if (!backupBranch || !commitHash) {
      throw new Error('Invalid snapshot key format. Rollback aborted.');
    }

    try {
      // 1. Reset working directory files hard to the snapshot commit
      await execAsync(`git reset --hard ${commitHash}`, { cwd: this.projectRoot });

      // 2. Remove newly created files/directories
      await execAsync('git clean -fd', { cwd: this.projectRoot });

      // 3. Safely delete the backup branch
      try {
        await execAsync(`git branch -D ${backupBranch}`, { cwd: this.projectRoot });
      } catch {
        // Safe failover
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Critical rollback operation failed: ${msg}`);
    }
  }
}
