/**
 * MetaCLI — CLI Entry Point
 *
 * Main entry point for the `metacli` command.
 * Uses Commander for argument parsing and dispatches to
 * Ink-based UI components for rendering.
 */

import { Command } from 'commander';
import { askCommand } from './commands/ask.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { dashboardCommand } from './commands/dashboard.js';
import { scanCommand } from './commands/scan.js';
import { runCommand } from './commands/run.js';
import { auditCommand } from './commands/audit.js';

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
  .action(askCommand);

program
  .command('status')
  .description('Show detected providers and their health status')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

program
  .command('config')
  .description('Show or edit MetaCLI configuration')
  .option('--show', 'Show current configuration')
  .option('--path', 'Show config file path')
  .action(configCommand);

program
  .command('scan')
  .description('Index workspace codebase symbols, dependencies, and file structures')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('--force', 'Force full rebuild of the database index')
  .action(scanCommand);

program
  .command('run')
  .description('Execute an autonomous multi-step workflow task graph')
  .option('-f, --file <file>', 'JSON task graph path (defaults to metacli-tasks.json)')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-m, --mode <mode>', 'Safety mode override (safe, trusted, autonomous)')
  .action(runCommand);

program
  .command('audit')
  .description('View relational security and process execution audit logs')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .option('-l, --limit <limit>', 'Max audit logs to display')
  .action(auditCommand);

program
  .command('dashboard')
  .description('Open the interactive terminal dashboard')
  .option('-t, --tab <tab>', 'Initial tab (prompt, dashboard, brain, providers, usage, sessions)')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action(dashboardCommand);

program
  .command('brain')
  .description('Open the persistent project brain explorer')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action((options) => dashboardCommand({ ...options, tab: 'brain' }));

program
  .command('providers')
  .description('Show status and health of all AI adapters')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action((options) => dashboardCommand({ ...options, tab: 'providers' }));

program
  .command('usage')
  .description('Show provider token usage and cost dashboard')
  .option('-d, --dir <directory>', 'Working directory', process.cwd())
  .action((options) => dashboardCommand({ ...options, tab: 'usage' }));

// Parse and execute
if (process.argv.length === 2) {
  // If no subcommand is specified, open interactive dashboard directly
  dashboardCommand({ dir: process.cwd(), tab: 'prompt' });
} else {
  program.parse();
}

