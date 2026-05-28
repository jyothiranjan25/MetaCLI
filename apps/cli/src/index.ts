/**
 * MetaCLI — CLI Entry Point
 *
 * Main entry point for the `metacli` command.
 * Uses Commander for argument parsing and dispatches to
 * Ink-based UI components for rendering.
 */

import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';

const program = new Command();

program
  .name('metacli')
  .description('Unified orchestration CLI for AI coding CLIs')
  .version('0.1.0');

// ─── Commands ───────────────────────────────────────────────

program
  .command('ask')
  .description('Send a prompt to the best available AI provider')
  .argument('<prompt>', 'The prompt to send')
  .option('-p, --provider <provider>', 'Preferred provider (e.g., claude-code, gemini-cli)')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-f, --files <files...>', 'Files to include as context')
  .option('--system <prompt>', 'System prompt')
  .option('--no-fallback', 'Disable automatic provider fallback')
  .option('--verbose', 'Enable verbose output')
  .action(async (prompt, options) => {
    const { askCommand } = await import('./commands/ask.js');
    await askCommand(prompt, options);
  });

program
  .command('status')
  .description('Show detected providers and their health status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { statusCommand } = await import('./commands/status.js');
    await statusCommand(options);
  });

program
  .command('config')
  .description('Show or edit MetaCLI configuration')
  .option('--show', 'Show current configuration')
  .option('--path', 'Show config file path')
  .action(async (options) => {
    const { configCommand } = await import('./commands/config.js');
    await configCommand(options);
  });

program
  .command('scan')
  .description('Index workspace codebase symbols, dependencies, and file structures')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('--force', 'Force full rebuild of the database index')
  .action(async (options) => {
    const { scanCommand } = await import('./commands/scan.js');
    await scanCommand(options);
  });

program
  .command('run')
  .description('Execute an autonomous multi-step workflow task graph')
  .option('-f, --file <file>', 'JSON task graph path (defaults to metacli-tasks.json)')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-m, --mode <mode>', 'Safety mode override (safe, trusted, autonomous)')
  .action(async (options) => {
    const { runCommand } = await import('./commands/run.js');
    await runCommand(options);
  });

program
  .command('audit')
  .description('View relational security and process execution audit logs')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-l, --limit <limit>', 'Max audit logs to display')
  .action(async (options) => {
    const { auditCommand } = await import('./commands/audit.js');
    await auditCommand(options);
  });

program
  .command('dashboard')
  .description('Open the interactive terminal dashboard')
  .option('-t, --tab <tab>', 'Initial tab (prompt, dashboard, brain, providers, usage, sessions)')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand(options);
  });

program
  .command('brain')
  .description('Open the persistent project brain explorer')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand({ ...options, tab: 'brain' });
  });

program
  .command('providers')
  .description('Show status and health of all AI adapters')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand({ ...options, tab: 'providers' });
  });

program
  .command('usage')
  .description('Show provider token usage and cost dashboard')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand({ ...options, tab: 'usage' });
  });

program.addCommand(setupCommand());

// Parse and execute
if (process.argv.length === 2) {
  // If no subcommand is specified, open interactive dashboard directly
  import('./commands/dashboard.js').then(({ dashboardCommand }) => {
    dashboardCommand({ dir: process.cwd(), tab: 'prompt' });
  });
} else {
  program.parse();
}

