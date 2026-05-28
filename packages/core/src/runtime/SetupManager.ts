/**
 * MetaCLI — Setup Manager
 * 
 * Coordinates the first-time setup and health checks of the CLI environment.
 */

import { GlobalStorage } from './GlobalStorage.js';
import fs from 'node:fs';

export interface SetupResult {
  isFirstTime: boolean;
  globalPath: string;
  checks: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message?: string }>;
}

export class SetupManager {
  // Second arg (eventBus) is accepted for API compatibility but not used yet
  constructor(private storage: GlobalStorage, ..._args: unknown[]) {}


  /**
   * Performs the initial setup sequence.
   */
  public async runSetup(): Promise<SetupResult> {
    const isFirstTime = !fs.existsSync(this.storage.getRoot());
    
    // 1. Initialize directories
    this.storage.initialize();

    const result: SetupResult = {
      isFirstTime,
      globalPath: this.storage.getRoot(),
      checks: [],
    };

    // 2. Placeholder for more advanced checks (e.g. Node version, Git availability)
    result.checks.push({ name: 'storage', status: 'ok', message: 'Global storage initialized' });

    return result;
  }
}
