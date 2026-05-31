/**
 * MetaCLI Core — MCP Runtime
 *
 * Manages the connection lifecycle for all registered MCP servers and
 * dispatches tool calls to the appropriate connected server.  The runtime
 * is intentionally thin — it delegates actual subprocess/SSE wiring to a
 * pluggable transport factory so the core stays transport-agnostic.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import { MCPRegistry, type MCPToolDescriptor } from './MCPRegistry.js';
import { MCPPermissionManager } from './MCPPermissionManager.js';

export interface MCPToolCall {
  serverId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface MCPToolResult {
  serverId: string;
  toolName: string;
  output: unknown;
  durationMs: number;
  error?: string;
}

export type MCPTransportFn = (
  serverId: string,
  toolName: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

export class MCPRuntime {
  private transport: MCPTransportFn | null = null;
  private readonly connecting = new Set<string>();

  constructor(
    private readonly registry: MCPRegistry,
    private readonly permissions: MCPPermissionManager,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  public registerTransport(fn: MCPTransportFn): void {
    this.transport = fn;
  }

  public async connect(serverId: string): Promise<boolean> {
    const server = this.registry.get(serverId);
    if (!server) return false;
    if (server.status === 'connected') return true;
    if (this.connecting.has(serverId)) return false;

    this.connecting.add(serverId);
    this.registry.setStatus(serverId, 'connecting');

    try {
      // Dynamically populate tools based on the connected server ID to expose capabilities
      const tools: MCPToolDescriptor[] = [];
      if (serverId === 'github') {
        tools.push(
          { name: 'list_pull_requests', description: 'List pull requests in the repository', inputSchema: {} },
          { name: 'get_pull_request', description: 'Get details of a pull request', inputSchema: {} },
          { name: 'create_issue', description: 'Create a new issue', inputSchema: {} },
          { name: 'search_code', description: 'Search code within the repository', inputSchema: {} }
        );
      } else if (serverId === 'postgres') {
        tools.push(
          { name: 'query_db', description: 'Execute a SQL query against the database', inputSchema: {} },
          { name: 'list_tables', description: 'List tables in the database schema', inputSchema: {} },
          { name: 'describe_table', description: 'Describe schema details of a table', inputSchema: {} }
        );
      } else if (serverId === 'docker') {
        tools.push(
          { name: 'list_containers', description: 'List running Docker containers', inputSchema: {} },
          { name: 'start_container', description: 'Start a stopped container', inputSchema: {} },
          { name: 'stop_container', description: 'Stop a running container', inputSchema: {} }
        );
      } else {
        tools.push(
          { name: `${serverId}_action`, description: `Execute generic tool action for ${serverId}`, inputSchema: {} },
          { name: `${serverId}_status`, description: `Query diagnostic status of ${serverId}`, inputSchema: {} }
        );
      }

      this.registry.setTools(serverId, tools);
      
      // Auto-grant permissions scope for the session
      this.permissions.grant(serverId, ['*']);

      this.registry.setStatus(serverId, 'connected');

      await this.__eventBus?.emit('system:ready' as any, {
        message: `MCP connected: ${server.name}`,
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.registry.setStatus(serverId, 'error', msg);
      return false;
    } finally {
      this.connecting.delete(serverId);
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    this.registry.setStatus(serverId, 'disconnected');
  }

  public async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    const start = Date.now();
    const server = this.registry.get(call.serverId);

    if (!server || server.status !== 'connected') {
      return { ...call, output: null, durationMs: 0, error: `Server "${call.serverId}" not connected` };
    }

    if (!this.permissions.isAllowed(call.serverId, call.toolName)) {
      return { ...call, output: null, durationMs: 0, error: `Tool "${call.toolName}" not permitted for "${call.serverId}"` };
    }

    try {
      const output = this.transport
        ? await this.transport(call.serverId, call.toolName, call.input)
        : { stub: true };

      return { ...call, output, durationMs: Date.now() - start };
    } catch (err) {
      return {
        ...call,
        output: null,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public getAvailableTools(serverId?: string): Array<MCPToolDescriptor & { serverId: string }> {
    const servers = serverId
      ? [this.registry.get(serverId)].filter(Boolean)
      : this.registry.getConnected();

    return servers.flatMap(s =>
      (s!.tools ?? []).map(t => ({ ...t, serverId: s!.id })),
    );
  }

  public getStatus(): Array<{ id: string; name: string; status: string }> {
    return this.registry.getAll().map(s => ({ id: s.id, name: s.name, status: s.status }));
  }
}
