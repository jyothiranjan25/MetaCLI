/**
 * MetaCLI Core — Profile Loader
 * 
 * Loads workspace-local configuration profiles (e.g. .metacli-profile.json)
 * to override default global routing and token behaviors per repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { MetaCLIConfig } from './schema.js';

export interface MetaCLIProfile {
  preferredProvider?: string;
  verbose?: boolean;
  maxContextTokens?: number;
  ignorePaths?: string[];
  securityMode?: 'safe' | 'trusted' | 'autonomous';
}

export class ProfileLoader {
  private activeProfilePath: string | null = null;
  private profile: MetaCLIProfile | null = null;

  /**
   * Scan and load a local workspace profile.
   * Checks for .metacli-profile.json in the working directory root.
   */
  public load(workDir: string): MetaCLIProfile | null {
    const candidates = [
      path.join(workDir, '.metacli-profile.json'),
      path.join(workDir, '.metacli', 'profile.json'),
    ];

    for (const filepath of candidates) {
      if (fs.existsSync(filepath)) {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content) as MetaCLIProfile;
          if (data && typeof data === 'object') {
            this.activeProfilePath = filepath;
            this.profile = data;
            return data;
          }
        } catch {
          // Ignore parsing errors and try next candidate
        }
      }
    }

    return null;
  }

  /**
   * Get the active profile path (null if none loaded).
   */
  public getActiveProfilePath(): string | null {
    return this.activeProfilePath;
  }

  /**
   * Merge profile override values cleanly into the parsed MetaCLIConfig.
   */
  public merge(config: MetaCLIConfig): MetaCLIConfig {
    if (!this.profile) return config;

    const merged = { ...config };

    if (this.profile.preferredProvider) {
      merged.routing = {
        ...merged.routing,
        preferredProvider: this.profile.preferredProvider,
      };
    }

    if (this.profile.verbose !== undefined) {
      merged.verbose = this.profile.verbose;
    }

    if (this.profile.ignorePaths && Array.isArray(this.profile.ignorePaths)) {
      merged.brain = {
        ...merged.brain,
        ignorePaths: Array.from(new Set([...merged.brain.ignorePaths, ...this.profile.ignorePaths])),
      };
    }

    if (this.profile.securityMode) {
      merged.security = {
        ...merged.security,
        mode: this.profile.securityMode,
      };
    }

    return merged;
  }
}
