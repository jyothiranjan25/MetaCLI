import React from 'react';
import { render } from 'ink';
import { bootstrap } from '../bootstrap.js';
import { InteractiveDashboardView } from '../ui/InteractiveDashboardView.js';

interface DashboardCommandOptions {
  tab?: string;
  dir: string;
}

export async function dashboardCommand(options: DashboardCommandOptions): Promise<void> {
  try {
    const { orchestrator, eventBus } = await bootstrap(options.dir);

    // Boot interactive UI
    const { waitUntilExit } = render(
      React.createElement(InteractiveDashboardView, {
        orchestrator,
        eventBus,
        workingDirectory: options.dir,
        initialTab: options.tab ?? 'prompt',
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
