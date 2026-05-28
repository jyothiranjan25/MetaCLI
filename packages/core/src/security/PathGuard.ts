/**
 * MetaCLI Core — Path Guard
 *
 * Enforces strict workspace filesystem sandboxing and boundary constraints.
 * Ensures the runtime never accesses, reads, writes, crawls, or indexes outside allowed paths
 * or into blacklisted sensitive credential zones (like ~/.ssh or ~/.aws).
 */

import { homedir } from 'node:os';
import path from 'node:path';

export class PathBoundaryError extends Error {
  constructor(message: string) {
    super(`Workspace Isolation Violation: ${message}`);
    this.name = 'PathBoundaryError';
  }
}

export class PathGuard {
  /**
   * Helper to expand tilde (~) into absolute home directory path and resolve the target absolutely.
   */
  static resolve(p: string, workspaceRoot: string): string {
    let resolved = p.trim();
    if (resolved.startsWith('~')) {
      resolved = path.join(homedir(), resolved.slice(1));
    }
    return path.resolve(workspaceRoot, resolved);
  }

  /**
   * Determine if a target path is allowed under workspace boundary policies.
   */
  static isPathAllowed(
    targetPath: string,
    workspaceRoot: string,
    allowedPaths: string[] = [],
    blockedPaths: string[] = [
      '~/.ssh',
      '~/.aws',
      '~/.config',
      '~/.npm',
      '~/.pnpm-state',
      '~/.gitconfig',
      '~/Library',
      '~/Documents',
    ]
  ): boolean {
    const resolvedWorkspace = this.resolve(workspaceRoot, workspaceRoot);
    const resolvedTarget = this.resolve(targetPath, workspaceRoot);

    // 1. Always evaluate denylist (blockedPaths) first. If target is blocked, reject!
    for (const blockedPattern of blockedPaths) {
      const resolvedBlocked = this.resolve(blockedPattern, workspaceRoot);
      const isTargetBlocked =
        resolvedTarget === resolvedBlocked ||
        resolvedTarget.startsWith(resolvedBlocked + path.sep);

      if (isTargetBlocked) {
        // If the blocked directory is a parent of the workspace root,
        // we only block access if the target path is outside the workspace root.
        const isParentOfWorkspace =
          resolvedWorkspace === resolvedBlocked ||
          resolvedWorkspace.startsWith(resolvedBlocked + path.sep);

        if (isParentOfWorkspace) {
          const relativeToWorkspace = path.relative(resolvedWorkspace, resolvedTarget);
          const isOutside =
            relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace);
          if (isOutside) {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    // 2. Evaluate allowed whitelisted paths next
    for (const allowedPattern of allowedPaths) {
      const resolvedAllowed = this.resolve(allowedPattern, workspaceRoot);
      if (
        resolvedTarget === resolvedAllowed ||
        resolvedTarget.startsWith(resolvedAllowed + path.sep)
      ) {
        return true;
      }
    }

    // 3. Fallback: target must reside strictly within the active workspace root
    const relative = path.relative(resolvedWorkspace, resolvedTarget);
    const isSubPath = !relative.startsWith('..') && !path.isAbsolute(relative);
    const isExact = resolvedTarget === resolvedWorkspace;

    return isSubPath || isExact;
  }

  /**
   * Enforce filesystem safety. Throws a PathBoundaryError if the policy is violated.
   */
  static enforce(
    targetPath: string,
    workspaceRoot: string,
    allowedPaths: string[] = [],
    blockedPaths: string[] = []
  ): void {
    const defaultBlocked = [
      '~/.ssh',
      '~/.aws',
      '~/.config',
      '~/.npm',
      '~/.pnpm-state',
      '~/.gitconfig',
      '~/Library',
      '~/Documents',
    ];
    
    const combinedBlocked = [...new Set([...blockedPaths, ...defaultBlocked])];

    if (!this.isPathAllowed(targetPath, workspaceRoot, allowedPaths, combinedBlocked)) {
      throw new PathBoundaryError(
        `Access to path "${targetPath}" is blocked by system filesystem policy.`
      );
    }
  }
}
