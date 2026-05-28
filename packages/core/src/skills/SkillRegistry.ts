/**
 * MetaCLI Core — Skill Registry
 *
 * The typed catalog of all installed skills. A skill bundles a capability:
 * its description, preferred providers, retrieval strategy, memory namespace,
 * and prompt modifiers. Registry is persisted to disk and loaded at startup.
 */

export type SkillStatus = 'enabled' | 'disabled' | 'installed' | 'error';

export type RetrievalStrategy = 'broad' | 'focused' | 'graph-only' | 'memory-only';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  /** Categories this skill operates in */
  categories: string[];
  /** Provider IDs this skill prefers, in priority order */
  preferredProviders: string[];
  /** How retrieval should behave when this skill is active */
  retrievalStrategy: RetrievalStrategy;
  /** Memory namespace for skill-specific storage */
  memoryNamespace: string;
  /** Additional system-prompt modifier injected when skill is active */
  systemPromptModifier?: string;
  /** MCP server IDs required by this skill */
  requiredMCP?: string[];
  /** Slash commands this skill registers */
  commands?: Array<{ name: string; description: string; argHint?: string }>;
  /** Whether skill is a first-party built-in */
  builtin: boolean;
}

export interface SkillEntry extends SkillDefinition {
  status: SkillStatus;
  installedAt: number;
  enabledAt?: number;
  errorMessage?: string;
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillEntry>();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    const builtins: SkillDefinition[] = [
      {
        id: 'github',
        name: 'GitHub',
        description: 'PR reviews, issue management, repository navigation via GitHub MCP',
        version: '1.0.0',
        categories: ['vcs', 'collaboration'],
        preferredProviders: ['claude'],
        retrievalStrategy: 'focused',
        memoryNamespace: 'skill:github',
        systemPromptModifier: 'You have access to GitHub via MCP. Use it to read PRs, issues, and code.',
        requiredMCP: ['github'],
        commands: [{ name: 'pr', description: 'Open or review a pull request', argHint: '<pr-number>' }],
        builtin: true,
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Issue tracking, sprint planning, and ticket management',
        version: '1.0.0',
        categories: ['project-management'],
        preferredProviders: ['claude'],
        retrievalStrategy: 'memory-only',
        memoryNamespace: 'skill:jira',
        systemPromptModifier: 'You have Jira access. Reference tickets by key (e.g. PROJ-123).',
        requiredMCP: ['jira'],
        commands: [{ name: 'ticket', description: 'View or update a Jira ticket', argHint: '<ticket-key>' }],
        builtin: true,
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Database schema inspection, query generation, and migration review',
        version: '1.0.0',
        categories: ['database'],
        preferredProviders: ['claude', 'codex'],
        retrievalStrategy: 'focused',
        memoryNamespace: 'skill:postgres',
        systemPromptModifier: 'You can query the connected PostgreSQL database. Prefer read-only operations.',
        requiredMCP: ['postgres'],
        builtin: true,
      },
      {
        id: 'docker',
        name: 'Docker',
        description: 'Container management, Dockerfile authoring, compose orchestration',
        version: '1.0.0',
        categories: ['infrastructure'],
        preferredProviders: ['claude', 'opencode'],
        retrievalStrategy: 'graph-only',
        memoryNamespace: 'skill:docker',
        systemPromptModifier: 'You can inspect running containers and images via Docker MCP.',
        requiredMCP: ['docker'],
        builtin: true,
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Issue management, cycle planning, and project tracking via Linear',
        version: '1.0.0',
        categories: ['project-management'],
        preferredProviders: ['claude'],
        retrievalStrategy: 'memory-only',
        memoryNamespace: 'skill:linear',
        requiredMCP: ['linear'],
        commands: [{ name: 'issue', description: 'View or create a Linear issue', argHint: '<issue-id>' }],
        builtin: true,
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Channel search, message drafting, and notification management',
        version: '1.0.0',
        categories: ['collaboration'],
        preferredProviders: ['claude'],
        retrievalStrategy: 'memory-only',
        memoryNamespace: 'skill:slack',
        requiredMCP: ['slack'],
        builtin: true,
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Wiki authoring, page search, and database queries',
        version: '1.0.0',
        categories: ['documentation'],
        preferredProviders: ['claude'],
        retrievalStrategy: 'broad',
        memoryNamespace: 'skill:notion',
        requiredMCP: ['notion'],
        builtin: true,
      },
      {
        id: 'kubernetes',
        name: 'Kubernetes',
        description: 'Cluster inspection, manifest authoring, deployment management',
        version: '1.0.0',
        categories: ['infrastructure'],
        preferredProviders: ['claude', 'opencode'],
        retrievalStrategy: 'graph-only',
        memoryNamespace: 'skill:kubernetes',
        requiredMCP: ['kubernetes'],
        builtin: true,
      },
    ];

    for (const def of builtins) {
      this.skills.set(def.id, { ...def, status: 'installed', installedAt: Date.now() });
    }
  }

  public install(def: SkillDefinition): void {
    const existing = this.skills.get(def.id);
    this.skills.set(def.id, {
      ...def,
      status: 'installed',
      installedAt: existing?.installedAt ?? Date.now(),
    });
  }

  public remove(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill || skill.builtin) return false;
    return this.skills.delete(skillId);
  }

  public enable(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;
    skill.status = 'enabled';
    skill.enabledAt = Date.now();
    return true;
  }

  public disable(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;
    skill.status = skill.status === 'enabled' ? 'installed' : skill.status;
    return true;
  }

  public get(skillId: string): SkillEntry | undefined {
    return this.skills.get(skillId);
  }

  public getEnabled(): SkillEntry[] {
    return [...this.skills.values()].filter(s => s.status === 'enabled');
  }

  public getAll(): SkillEntry[] {
    return [...this.skills.values()];
  }

  public isEnabled(skillId: string): boolean {
    return this.skills.get(skillId)?.status === 'enabled';
  }
}
