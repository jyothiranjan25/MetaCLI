import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import path from 'node:path';
import { PathGuard, PathBoundaryError } from './PathGuard.js';

describe('PathGuard', () => {
  const workspaceRoot = '/Users/jo/project';

  it('should allow paths strictly inside the workspace root', () => {
    expect(PathGuard.isPathAllowed('/Users/jo/project/src/index.ts', workspaceRoot)).toBe(true);
    expect(PathGuard.isPathAllowed('src/index.ts', workspaceRoot)).toBe(true);
    expect(PathGuard.isPathAllowed('/Users/jo/project', workspaceRoot)).toBe(true);
  });

  it('should block paths outside the workspace root', () => {
    expect(PathGuard.isPathAllowed('/Users/jo/other-project/file.ts', workspaceRoot)).toBe(false);
    expect(PathGuard.isPathAllowed('../outside.ts', workspaceRoot)).toBe(false);
  });

  it('should allow outside paths that are explicitly whitelisted', () => {
    const allowed = ['/Users/jo/shared-docs', '../shared-scripts'];
    expect(PathGuard.isPathAllowed('/Users/jo/shared-docs/readme.md', workspaceRoot, allowed)).toBe(true);
    expect(PathGuard.isPathAllowed('/Users/jo/shared-scripts/run.sh', workspaceRoot, allowed)).toBe(true);
  });

  it('should always block directories on the denylist (like ~/.ssh)', () => {
    const sshPath = path.join(homedir(), '.ssh/id_rsa');
    const awsPath = path.join(homedir(), '.aws/credentials');

    expect(PathGuard.isPathAllowed(sshPath, workspaceRoot)).toBe(false);
    expect(PathGuard.isPathAllowed(awsPath, workspaceRoot)).toBe(false);
  });

  it('should throw an error on enforcement failure', () => {
    expect(() => {
      PathGuard.enforce('/Users/jo/other-project/file.ts', workspaceRoot);
    }).toThrow(PathBoundaryError);

    expect(() => {
      PathGuard.enforce('/Users/jo/project/src/index.ts', workspaceRoot);
    }).not.toThrow();
  });
});
