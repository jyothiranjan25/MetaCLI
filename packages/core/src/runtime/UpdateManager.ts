/**
 * MetaCLI — Update Manager
 * 
 * Handles version checking and self-updates.
 */

import { execSync } from 'node:child_process';

export interface VersionInfo {
  current: string;
  latest: string;
  isOutdated: boolean;
}

export class UpdateManager {
  constructor(
    private currentVersion: string
  ) {}

  /**
   * Checks if a newer version of MetaCLI is available on NPM.
   */
  public async checkForUpdates(): Promise<VersionInfo | null> {
    try {
      // Use npm view to get the latest version (fast)
      const latest = execSync('npm view @metacli/cli version', { stdio: 'pipe' }).toString().trim();
      
      return {
        current: this.currentVersion,
        latest,
        isOutdated: latest !== this.currentVersion,
      };
    } catch (error) {
      // Silently fail to not block CLI execution
      return null;
    }
  }

  /**
   * Performs a self-update.
   */
  public async performUpdate(): Promise<void> {
    try {
      execSync('npm install -g @metacli/cli', { stdio: 'inherit' });
    } catch (error: any) {
      throw new Error(`Failed to update MetaCLI: ${error.message}`);
    }
  }
}
