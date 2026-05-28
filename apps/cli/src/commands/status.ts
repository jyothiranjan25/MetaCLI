/**
 * MetaCLI CLI — `status` Command
 *
 * Shows detected providers, authentication status, and health scores.
 */

import { bootstrap } from '../bootstrap.js';

interface StatusCommandOptions {
  json?: boolean;
}

export async function statusCommand(options: StatusCommandOptions): Promise<void> {
  try {
    const { orchestrator } = await bootstrap();

    console.log('\n🔍 Detecting AI providers...\n');

    const providers = await orchestrator.detectProviders();

    if (options.json) {
      const json = Object.fromEntries(
        Array.from(providers.entries()).map(([id, info]) => [id, info]),
      );
      console.log(JSON.stringify(json, null, 2));
      return;
    }

    // Pretty table output
    const maxIdLen = Math.max(...Array.from(providers.keys()).map((k) => k.length), 10);

    console.log(
      `  ${'Provider'.padEnd(maxIdLen)}  ${'Installed'.padEnd(10)}  ${'Authenticated'.padEnd(14)}`,
    );
    console.log(`  ${'─'.repeat(maxIdLen)}  ${'─'.repeat(10)}  ${'─'.repeat(14)}`);

    for (const [id, info] of providers) {
      const installed = info.installed ? '✅ Yes' : '❌ No';
      const authenticated = info.authenticated ? '✅ Yes' : '❌ No';
      console.log(`  ${id.padEnd(maxIdLen)}  ${installed.padEnd(10)}  ${authenticated.padEnd(14)}`);
    }

    const available = Array.from(providers.entries()).filter(
      ([, info]) => info.installed && info.authenticated,
    );

    console.log(`\n  ${available.length} provider(s) ready for use.\n`);
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
