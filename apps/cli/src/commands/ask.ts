/**
 * MetaCLI CLI — `ask` Command
 *
 * The primary command. Sends a prompt through the orchestrator,
 * which handles routing, fallback, and streaming.
 *
 * Renders output using Ink for a polished terminal experience.
 */

import React from 'react';
import { render } from 'ink';
import { bootstrap } from '../bootstrap.js';
import { AskView } from '../ui/AskView.js';

interface AskCommandOptions {
  provider?: string;
  dir: string;
  files?: string[];
  system?: string;
  fallback?: boolean;
  verbose?: boolean;
}

export async function askCommand(prompt: string, options: AskCommandOptions): Promise<void> {
  try {
    const { orchestrator, eventBus } = await bootstrap(options.dir);

    // Detect available providers first
    const providers = await orchestrator.detectProviders();

    const availableProviders = Array.from(providers.entries())
      .filter(([, info]) => info.installed && info.authenticated)
      .map(([id]) => id);

    if (availableProviders.length === 0) {
      console.error('\n❌ No AI providers detected or authenticated.\n');
      console.error('MetaCLI orchestrates installed AI CLIs. Please ensure at least one is set up:\n');
      console.error('  • Claude Code:  npm install -g @anthropic-ai/claude-code && claude login');
      console.error('  • Gemini CLI:   npm install -g @google/gemini-cli && gemini');
      console.error('');
      process.exit(1);
    }

    // Render the Ink UI
    const { waitUntilExit } = render(
      React.createElement(AskView, {
        orchestrator,
        eventBus,
        prompt,
        preferredProvider: options.provider,
        workingDirectory: options.dir,
        files: options.files,
        systemPrompt: options.system,
        verbose: options.verbose ?? false,
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
