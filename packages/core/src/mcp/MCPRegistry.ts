/**
 * MetaCLI Core — MCP Registry
 *
 * Typed catalog of all known MCP server configurations. Each entry stores
 * the connection parameters, supported tools, and permission scope.
 * Built-in entries cover the standard engineering ecosystem servers.
 */

export type MCPTransport = 'stdio' | 'sse' | 'http';
export type MCPStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  transport: MCPTransport;
  /** Command to launch (for stdio transport) */
  command?: string;
  args?: string[];
  /** URL (for sse/http transport) */
  url?: string;
  /** Environment variables injected on connect */
  env?: Record<string, string>;
  /** Known tool descriptors (populated on connect) */
  tools?: MCPToolDescriptor[];
  /** Permission scopes required */
  requiredScopes: string[];
  builtin: boolean;
}

export interface MCPServerEntry extends MCPServerConfig {
  status: MCPStatus;
  connectedAt?: number;
  errorMessage?: string;
}

export class MCPRegistry {
  private readonly servers = new Map<string, MCPServerEntry>();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    const builtins: MCPServerConfig[] = [
      {
        id: 'github',
        name: 'GitHub',
        description: 'GitHub repositories, PRs, issues, and code review via MCP',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
        requiredScopes: ['repo', 'read:org'],
        builtin: true,
      },
      {
        id: 'gitlab',
        name: 'GitLab',
        description: 'GitLab repositories, merge requests, and CI/CD pipelines',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-gitlab'],
        env: { GITLAB_PERSONAL_ACCESS_TOKEN: '', GITLAB_API_URL: 'https://gitlab.com' },
        requiredScopes: ['api', 'read_repository'],
        builtin: true,
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Jira issues, sprints, and project management',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-jira'],
        env: { JIRA_HOST: '', JIRA_API_TOKEN: '', JIRA_EMAIL: '' },
        requiredScopes: ['read:jira-work', 'write:jira-work'],
        builtin: true,
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Linear issues, cycles, and roadmap',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-linear'],
        env: { LINEAR_API_KEY: '' },
        requiredScopes: ['issues:read', 'issues:write'],
        builtin: true,
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Slack channels, messages, and notifications',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
        requiredScopes: ['channels:read', 'chat:write'],
        builtin: true,
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Notion pages, databases, and workspace content',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-notion'],
        env: { NOTION_API_TOKEN: '' },
        requiredScopes: ['read_content', 'update_content'],
        builtin: true,
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'PostgreSQL schema, queries, and data exploration',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { POSTGRES_CONNECTION_STRING: '' },
        requiredScopes: ['read'],
        builtin: true,
      },
      {
        id: 'docker',
        name: 'Docker',
        description: 'Docker containers, images, and compose stacks',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-docker'],
        requiredScopes: ['containers:read', 'images:read'],
        builtin: true,
      },
      {
        id: 'kubernetes',
        name: 'Kubernetes',
        description: 'Kubernetes pods, deployments, and cluster resources',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-kubernetes'],
        env: { KUBECONFIG: '' },
        requiredScopes: ['get', 'list', 'watch'],
        builtin: true,
      },
    ];

    for (const cfg of builtins) {
      this.servers.set(cfg.id, { ...cfg, status: 'disconnected' });
    }
  }

  public register(config: MCPServerConfig): void {
    this.servers.set(config.id, { ...config, status: 'disconnected' });
  }

  public get(serverId: string): MCPServerEntry | undefined {
    return this.servers.get(serverId);
  }

  public getAll(): MCPServerEntry[] {
    return [...this.servers.values()];
  }

  public getConnected(): MCPServerEntry[] {
    return [...this.servers.values()].filter(s => s.status === 'connected');
  }

  public setStatus(serverId: string, status: MCPStatus, error?: string): void {
    const entry = this.servers.get(serverId);
    if (!entry) return;
    entry.status = status;
    if (status === 'connected') entry.connectedAt = Date.now();
    if (error) entry.errorMessage = error;
  }

  public setTools(serverId: string, tools: MCPToolDescriptor[]): void {
    const entry = this.servers.get(serverId);
    if (entry) entry.tools = tools;
  }
}
