/**
 * MetaCLI — Slash Command Registry
 *
 * The complete typed catalog of all slash commands.
 * Supports aliases, categories, fuzzy search, contextual activation,
 * and plugin extensibility.
 */

export type CommandCategory =
  | 'navigation'
  | 'runtime'
  | 'provider'
  | 'workflow'
  | 'context'
  | 'debug'
  | 'system';

export interface SlashCommand {
  /** Primary name, e.g. "providers" (without leading slash) */
  name: string;
  /** Short description shown in palette */
  description: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Optional aliases */
  aliases?: string[];
  /** Optional argument hint, e.g. "<provider-id>" */
  argHint?: string;
  /** Whether this command opens an overlay */
  opensOverlay?: string;
  /** Keyboard shortcut label */
  shortcut?: string;
  /** Whether this command requires an active brain index */
  requiresBrain?: boolean;
  /** Whether this command is context-sensitive */
  contextual?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Navigation ──────────────────────────────────────────────
  {
    name: 'providers',
    description: 'Show provider status and health',
    category: 'navigation',
    aliases: ['p', 'provider-status'],
    opensOverlay: 'providers',
    shortcut: 'Ctrl+P',
  },
  {
    name: 'brain',
    description: 'Open project brain explorer',
    category: 'navigation',
    aliases: ['b', 'index'],
    opensOverlay: 'brain',
    requiresBrain: true,
  },
  {
    name: 'usage',
    description: 'Token usage and cost dashboard',
    category: 'navigation',
    aliases: ['u', 'tokens', 'cost'],
    opensOverlay: 'usage',
  },
  {
    name: 'sessions',
    description: 'Session timeline explorer',
    category: 'navigation',
    aliases: ['s', 'history'],
    opensOverlay: 'sessions',
  },
  {
    name: 'memory',
    description: 'Memory layer inspector (hot/warm/cold)',
    category: 'navigation',
    aliases: ['mem', 'm'],
    opensOverlay: 'memory',
    requiresBrain: true,
  },
  {
    name: 'graph',
    description: 'Architecture dependency graph',
    category: 'navigation',
    aliases: ['g', 'deps', 'dependencies'],
    opensOverlay: 'graph',
    requiresBrain: true,
  },
  {
    name: 'context',
    description: 'Active retrieval context inspector',
    category: 'navigation',
    aliases: ['ctx', 'retrieval'],
    opensOverlay: 'context',
  },
  {
    name: 'telemetry',
    description: 'System telemetry and performance',
    category: 'navigation',
    aliases: ['tel', 'metrics'],
    opensOverlay: 'telemetry',
  },
  {
    name: 'workflows',
    description: 'Autonomous workflow manager',
    category: 'navigation',
    aliases: ['wf', 'workflow'],
    opensOverlay: 'workflows',
  },
  {
    name: 'replay',
    description: 'Session replay viewer',
    category: 'navigation',
    aliases: ['r', 'playback'],
    opensOverlay: 'replay',
  },

  // ── Runtime ─────────────────────────────────────────────────
  {
    name: 'clear',
    description: 'Clear conversation history',
    category: 'runtime',
    aliases: ['cls', 'reset'],
    shortcut: 'Ctrl+L',
  },
  {
    name: 'reindex',
    description: 'Re-scan and index workspace',
    category: 'runtime',
    aliases: ['scan', 'index', 'rebuild'],
  },
  {
    name: 'compact',
    description: 'Compact and refine memory layers',
    category: 'runtime',
    aliases: ['compact-memory', 'prune'],
    requiresBrain: true,
  },
  {
    name: 'reload',
    description: 'Reload MetaCLI configuration',
    category: 'runtime',
    aliases: ['refresh', 'restart-config'],
  },

  // ── Provider ─────────────────────────────────────────────────
  {
    name: 'provider',
    description: 'Switch active AI provider',
    category: 'provider',
    argHint: '<claude|gemini|auto>',
    aliases: ['use', 'switch'],
  },

  // ── Workflow ─────────────────────────────────────────────────
  {
    name: 'agent',
    description: 'Switch to a specialized AI persona',
    category: 'workflow',
    argHint: '<architect|reviewer|hacker|security>',
    aliases: ['persona', 'role'],
  },
  {
    name: 'approve',
    description: 'Approve pending workflow step',
    category: 'workflow',
    contextual: true,
  },
  {
    name: 'reject',
    description: 'Reject pending workflow step',
    category: 'workflow',
    contextual: true,
  },
  {
    name: 'rollback',
    description: 'Rollback to last git checkpoint',
    category: 'workflow',
    aliases: ['undo', 'revert'],
    contextual: true,
  },
  {
    name: 'checkpoint',
    description: 'Create a git safety checkpoint',
    category: 'workflow',
    aliases: ['snap', 'snapshot'],
  },

  // ── Context ──────────────────────────────────────────────────
  {
    name: 'files',
    description: 'Add files to active context',
    category: 'context',
    argHint: '<glob-pattern>',
    aliases: ['add', 'attach'],
  },

  // ── Debug ────────────────────────────────────────────────────
  {
    name: 'events',
    description: 'Show live system event stream',
    category: 'debug',
    aliases: ['ev', 'event-log'],
    opensOverlay: 'events',
  },
  {
    name: 'logs',
    description: 'Show system logs',
    category: 'debug',
    aliases: ['log', 'stderr'],
    opensOverlay: 'logs',
  },
  {
    name: 'trace',
    description: 'Trace last retrieval decision',
    category: 'debug',
    aliases: ['explain', 'why'],
  },

  // ── System ───────────────────────────────────────────────────
  {
    name: 'help',
    description: 'Show all available commands',
    category: 'system',
    aliases: ['h', '?', 'commands'],
    opensOverlay: 'help',
    shortcut: 'Ctrl+H',
  },
  {
    name: 'settings',
    description: 'Open MetaCLI configuration',
    category: 'system',
    aliases: ['config', 'cfg'],
    opensOverlay: 'settings',
  },
];

/** Category display config */
export const CATEGORY_META: Record<CommandCategory, { label: string; color: string; icon: string }> = {
  navigation: { label: 'Navigation', color: 'cyan', icon: '⬡' },
  runtime:    { label: 'Runtime',    color: 'green', icon: '⚡' },
  provider:   { label: 'Providers',  color: 'magenta', icon: '◈' },
  workflow:   { label: 'Workflows',  color: 'yellow', icon: '⟳' },
  context:    { label: 'Context',    color: 'blue', icon: '◎' },
  debug:      { label: 'Debug',      color: 'red', icon: '⚙' },
  system:     { label: 'System',     color: 'white', icon: '◇' },
};

export class SlashCommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();

  constructor() {
    for (const cmd of SLASH_COMMANDS) {
      this.commands.set(cmd.name, cmd);
      for (const alias of cmd.aliases ?? []) {
        this.commands.set(alias, cmd);
      }
    }
  }

  /**
   * Find a command by exact name or alias.
   */
  find(name: string): SlashCommand | undefined {
    return this.commands.get(name.toLowerCase().replace(/^\//, ''));
  }

  /**
   * Fuzzy search commands by query string.
   * Returns ranked results with match score.
   */
  search(query: string, limit = 8): Array<{ command: SlashCommand; score: number }> {
    const q = query.toLowerCase().replace(/^\//, '');
    if (!q) {
      // Return all unique commands ordered by category priority
      return this.getAll().slice(0, limit).map((c) => ({ command: c, score: 1 }));
    }

    const results: Array<{ command: SlashCommand; score: number }> = [];
    const seen = new Set<string>();

    for (const cmd of this.getAll()) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);

      const score = this.fuzzyScore(q, cmd.name, cmd.description, cmd.aliases ?? []);
      if (score > 0) {
        results.push({ command: cmd, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get all unique commands (no aliases).
   */
  getAll(): SlashCommand[] {
    const seen = new Set<string>();
    return SLASH_COMMANDS.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }

  /**
   * Register a plugin command.
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
    for (const alias of command.aliases ?? []) {
      this.commands.set(alias, command);
    }
  }

  private fuzzyScore(query: string, name: string, desc: string, aliases: string[]): number {
    // Exact prefix match — highest score
    if (name.startsWith(query)) return 100 - name.length;

    // Any alias prefix match
    for (const alias of aliases) {
      if (alias.startsWith(query)) return 80;
    }

    // Contains match in name
    if (name.includes(query)) return 60;

    // Contains match in description
    if (desc.toLowerCase().includes(query)) return 30;

    // Character subsequence match
    if (this.subsequenceMatch(query, name)) return 20;

    return 0;
  }

  private subsequenceMatch(query: string, target: string): boolean {
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] === query[qi]) qi++;
    }
    return qi === query.length;
  }
}
