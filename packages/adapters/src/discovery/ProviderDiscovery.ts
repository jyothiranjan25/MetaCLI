/**
 * MetaCLI — Provider Discovery System
 * 
 * Automatically detects installed AI CLIs and validates their health/sessions.
 */

import { execa } from 'execa';
import path from 'node:path';
import fs from 'node:fs';

export interface ProviderMetadata {
  id: string;
  name: string;
  executable: string;
  isInstalled: boolean;
  version?: string;
  health: 'healthy' | 'unauthenticated' | 'missing' | 'error';
  path?: string;
}

export class ProviderDiscovery {
  private static KNOWN_PROVIDERS = [
    { id: 'claude', name: 'Claude Code', executable: 'claude' },
    { id: 'gemini', name: 'Gemini CLI', executable: 'gemini' },
    { id: 'aider', name: 'Aider', executable: 'aider' },
    { id: 'cursor', name: 'Cursor CLI', executable: 'cursor' },
  ];

  /**
   * Scans the system for installed AI providers in parallel.
   */
  public async discoverAll(): Promise<ProviderMetadata[]> {
    return Promise.all(
      ProviderDiscovery.KNOWN_PROVIDERS.map((provider) => this.probeProvider(provider))
    );
  }

  private async probeProvider(provider: typeof ProviderDiscovery.KNOWN_PROVIDERS[0]): Promise<ProviderMetadata> {
    const metadata: ProviderMetadata = {
      ...provider,
      isInstalled: false,
      health: 'missing',
    };

    try {
      // 1. Check if executable exists in PATH
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      const { stdout } = await execa(whichCmd, [provider.executable]);
      const fullPath = stdout.trim().split('\n')[0];

      if (fullPath && fs.existsSync(fullPath)) {
        metadata.isInstalled = true;
        metadata.path = fullPath;
        metadata.health = 'healthy';

        // 2. Try to get version (fast)
        try {
          const { stdout: versionOut } = await execa(provider.executable, ['--version'], { timeout: 2000 });
          metadata.version = versionOut.trim();
        } catch {
          // Some might not support --version or fail
        }

        // 3. Simple session check (optional/provider-specific)
        await this.validateSession(metadata);
      }
    } catch (error) {
      // Not found in path
    }

    return metadata;
  }

  private async validateSession(metadata: ProviderMetadata): Promise<void> {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    
    if (metadata.id === 'claude') {
      const configPaths = [
        path.join(home, '.config', 'claude-code', 'config.json'),
        path.join(home, 'Library', 'Application Support', 'claude-code', 'config.json'),
      ];
      
      for (const p of configPaths) {
        if (fs.existsSync(p)) {
          try {
            const config = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (config.sessions || config.accessToken) {
              metadata.health = 'healthy';
              return;
            }
          } catch {}
        }
      }
      metadata.health = 'unauthenticated';
    }

    if (metadata.id === 'gemini') {
      const configPath = path.join(home, '.config', 'google-gemini', 'config.json');
      if (fs.existsSync(configPath)) {
        metadata.health = 'healthy';
      } else {
        metadata.health = 'unauthenticated';
      }
    }
  }
}
