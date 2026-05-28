/**
 * MetaCLI — Global Storage Manager
 * 
 * Manages the ~/.metacli directory and global state (sessions, cache, telemetry).
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export class GlobalStorage {
  private root: string;

  constructor() {
    this.root = path.join(os.homedir(), '.metacli');
  }

  /**
   * Initializes the global storage directory structure.
   */
  public initialize(): void {
    const dirs = [
      '',
      'providers',
      'sessions',
      'telemetry',
      'logs',
      'cache',
      'workflows',
      'plugins',
      'brain',
    ];

    for (const dir of dirs) {
      const fullPath = path.join(this.root, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  public getPath(...parts: string[]): string {
    return path.join(this.root, ...parts);
  }

  public getRoot(): string {
    return this.root;
  }
}
