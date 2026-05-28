/**
 * MetaCLI — Slash Command Runtime
 *
 * Parses raw input for slash commands, routes to handlers,
 * manages command history, and provides autocomplete suggestions.
 */

import type { SlashCommand } from './SlashCommandRegistry.js';
import { SlashCommandRegistry } from './SlashCommandRegistry.js';

export interface ParsedSlashCommand {
  name: string;
  args: string[];
  raw: string;
  command: SlashCommand | undefined;
}

export interface CommandSuggestion {
  command: SlashCommand;
  displayText: string;
  score: number;
}

export type OverlayId =
  | 'providers'
  | 'brain'
  | 'usage'
  | 'sessions'
  | 'memory'
  | 'graph'
  | 'map'
  | 'timeline'
  | 'context'
  | 'telemetry'
  | 'workflows'
  | 'replay'
  | 'help'
  | 'settings'
  | 'events'
  | 'logs'
  | 'skills'
  | 'mcp'
  | 'tools'
  | null;

export interface SlashCommandResult {
  type: 'overlay' | 'action' | 'message' | 'unknown';
  overlayId?: OverlayId;
  message?: string;
  action?: string;
  args?: string[];
}

export class SlashCommandRuntime {
  private registry = new SlashCommandRegistry();
  private history: string[] = [];
  private historyIndex = -1;

  /**
   * Check if input starts with a slash command.
   */
  isSlashCommand(input: string): boolean {
    return input.startsWith('/');
  }

  /**
   * Parse raw slash command input.
   */
  parse(input: string): ParsedSlashCommand {
    const trimmed = input.trim().replace(/^\//, '');
    const parts = trimmed.split(/\s+/);
    const name = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);
    const command = this.registry.find(name);

    return { name, args, raw: input, command };
  }

  /**
   * Resolve a raw slash input to a canonical executable command string.
   * Exact names and aliases execute immediately; fuzzy matches execute when
   * there is a single clear no-argument command.
   */
  resolveExecutableInput(input: string): string | null {
    const parsed = this.parse(input);
    if (!parsed.name) return null;
    if (parsed.command) return `/${parsed.command.name}${parsed.args.length > 0 ? ` ${parsed.args.join(' ')}` : ''}`;

    const matches = this.getSuggestions(input, 2);
    if (matches.length !== 1) return null;
    const match = matches[0].command;
    if (match.argHint) return null;
    return `/${match.name}`;
  }

  /**
   * Execute a parsed slash command, returning the appropriate result.
   */
  execute(parsed: ParsedSlashCommand): SlashCommandResult {
    // Track history
    if (parsed.raw && !this.history.includes(parsed.raw)) {
      this.history.unshift(parsed.raw);
      if (this.history.length > 100) this.history.pop();
    }
    this.historyIndex = -1;

    if (!parsed.command) {
      return {
        type: 'message',
        message: `Unknown command: /${parsed.name}. Type /help to see all commands.`,
      };
    }

    const cmd = parsed.command;

    // Navigation commands → open overlay
    if (cmd.opensOverlay) {
      return {
        type: 'overlay',
        overlayId: cmd.opensOverlay as OverlayId,
      };
    }

    // Runtime commands
    switch (cmd.name) {
      case 'clear':
        return { type: 'action', action: 'clear' };

      case 'reindex':
        return { type: 'action', action: 'reindex' };

      case 'compact':
        return { type: 'action', action: 'compact' };

      case 'reload':
        return { type: 'action', action: 'reload' };

      case 'provider':
        return { type: 'action', action: 'switch-provider', args: parsed.args };

      case 'agent':
        return { type: 'action', action: 'switch-agent', args: parsed.args };

      case 'approve':
        return { type: 'action', action: 'workflow-approve' };

      case 'reject':
        return { type: 'action', action: 'workflow-reject' };

      case 'rollback':
        return { type: 'action', action: 'workflow-rollback' };

      case 'checkpoint':
        return { type: 'action', action: 'create-checkpoint' };

      case 'files':
        return { type: 'action', action: 'add-files', args: parsed.args };

      case 'trace':
        return { type: 'action', action: 'trace-retrieval' };

      default:
        return {
          type: 'message',
          message: `Running /${cmd.name}...`,
        };
    }
  }

  /**
   * Get autocomplete suggestions for partial slash input.
   */
  getSuggestions(partial: string, limit = 6): CommandSuggestion[] {
    const query = partial.replace(/^\//, '');
    const results = this.registry.search(query, limit);
    return results.map(({ command, score }) => ({
      command,
      displayText: `/${command.name}${command.argHint ? ' ' + command.argHint : ''}`,
      score,
    }));
  }

  /**
   * Get all commands (for palette display).
   */
  getAllCommands() {
    return this.registry.getAll();
  }

  /**
   * Search all commands (for palette fuzzy search).
   */
  searchCommands(query: string, limit = 10) {
    return this.registry.search(query, limit);
  }

  /**
   * Navigate command history (↑ = older, ↓ = newer).
   */
  historyUp(): string | null {
    if (this.history.length === 0) return null;
    this.historyIndex = Math.min(this.historyIndex + 1, this.history.length - 1);
    return this.history[this.historyIndex] ?? null;
  }

  historyDown(): string | null {
    if (this.historyIndex <= 0) {
      this.historyIndex = -1;
      return '';
    }
    this.historyIndex--;
    return this.history[this.historyIndex] ?? null;
  }

  getRecentCommands(limit = 5): string[] {
    return this.history.slice(0, limit);
  }
}
