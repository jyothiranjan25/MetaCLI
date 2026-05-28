/**
 * MetaCLI — Update Manager
 * 
 * Handles version checking and self-updates.
 */

import { execa } from 'execa';

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
      const { stdout } = await execa('npm', ['view', '@metacli/cli', 'version'], { timeout: 5000 });
      const latest = stdout.trim();
      
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
      await execa('npm', ['install', '-g', '@metacli/cli'], { stdio: 'inherit' });
    } catch (error: any) {
      throw new Error(`Failed to update MetaCLI: ${error.message}`);
    }
  }
}
