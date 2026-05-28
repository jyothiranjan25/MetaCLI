/**
 * MetaCLI CLI — `config` Command
 *
 * Shows or edits MetaCLI configuration.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { bootstrap } from '../bootstrap.js';

interface ConfigCommandOptions {
  show?: boolean;
  path?: boolean;
}

export async function configCommand(options: ConfigCommandOptions): Promise<void> {
  try {
    if (options.path) {
      const configPath = join(homedir(), '.metacli', 'config.yaml');
      console.log(configPath);
      return;
    }

    const { config } = await bootstrap();

    // Default: show current config
    console.log('\n📋 Current MetaCLI Configuration:\n');
    console.log(JSON.stringify(config, null, 2));
    console.log('');
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
