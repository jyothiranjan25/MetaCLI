/**
 * MetaCLI — Setup Command
 * 
 * Guided onboarding and health check for the CLI environment.
 */

import { Command } from 'commander';
import { bootstrap } from '../bootstrap.js';
import { ProviderDiscovery } from '@metacli/adapters';
import chalk from 'chalk';

export function setupCommand(): Command {
  return new Command('setup')
    .description('Initialize MetaCLI and detect available AI providers')
    .action(async () => {
      console.log(chalk.bold.cyan('\nMetaCLI — Initializing Engineering Intelligence Layer\n'));

      const { storage, eventBus } = await bootstrap();
      
      console.log(`${chalk.green('✔')} Global storage: ${chalk.dim(storage.getRoot())}`);

      const discovery = new ProviderDiscovery();
      console.log(chalk.yellow('\nScanning for AI providers in PATH...'));
      
      const providers = await discovery.discoverAll();
      
      for (const provider of providers) {
        if (provider.isInstalled) {
          const statusIcon = provider.health === 'healthy' ? chalk.green('✔') : chalk.yellow('⚠');
          const statusText = provider.health === 'healthy' ? chalk.green('Authenticated') : chalk.yellow('Unauthenticated');
          
          console.log(`${statusIcon} ${chalk.bold(provider.name)} detected ${chalk.dim(`(${provider.version || 'v?'})`)} — ${statusText}`);
          console.log(`  ${chalk.dim('Path:')} ${chalk.gray(provider.path)}`);
        } else {
          console.log(`${chalk.red('✘')} ${chalk.bold(provider.name)} not found`);
        }
      }

      console.log(chalk.bold.green('\nSetup complete. MetaCLI is ready to orchestrate.\n'));
      console.log(`Try running: ${chalk.cyan('metacli ask "Hello world"')}\n`);
    });
}
