import React from 'react';
import { render } from 'ink';
import { bootstrap } from '../bootstrap.js';
import { BrainStore, WorkspaceScanner } from '@metacli/brain';
import { ScanProgressView } from '../ui/ScanProgressView.js';

interface ScanCommandOptions {
  dir: string;
  force?: boolean;
}

export async function scanCommand(options: ScanCommandOptions): Promise<void> {
  const workingDir = options.dir || process.cwd();
  let store: BrainStore | null = null;

  try {
    const { eventBus, resolvedDir } = await bootstrap(workingDir);
    
    // Create the persistence and scanner instances
    store = new BrainStore(resolvedDir);
    const scanner = new WorkspaceScanner(resolvedDir, store, eventBus);

    // Render the visual progress scanner UI
    const { waitUntilExit } = render(
      React.createElement(ScanProgressView, {
        scanner,
        store,
        eventBus,
        force: options.force ?? false,
      }),
    );

    await waitUntilExit();
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    if (store) {
      try {
        store.close();
      } catch {
        // Safe failover
      }
    }
  }
}
