import React from 'react';
import { render } from 'ink';
import { bootstrap } from '../bootstrap.js';
import { ConversationRuntime } from '../ui/ConversationRuntime.js';

interface DashboardCommandOptions {
  tab?: string;
  dir: string;
}

export async function dashboardCommand(options: DashboardCommandOptions): Promise<void> {
  try {
    const { orchestrator, eventBus } = await bootstrap(options.dir);

    // Boot conversation-first UI
    const { waitUntilExit } = render(
      React.createElement(ConversationRuntime, {
        orchestrator,
        eventBus,
        workingDirectory: options.dir,
      }),
    );

    await waitUntilExit();
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
