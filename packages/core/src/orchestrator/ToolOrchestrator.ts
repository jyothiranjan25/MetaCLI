/**
 * MetaCLI Core — Tool Orchestrator
 *
 * Routes tool calls to the correct execution backend:
 *   - MCP tool calls → MCPRuntime
 *   - Built-in tools  → registered local handlers
 *   - Unknown tools   → capability engine for discovery
 *
 * Maintains an ordered tool call log for observability and replay.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import type { MCPRuntime, MCPToolCall, MCPToolResult } from '../mcp/MCPRuntime.js';
import type { CapabilityEngine } from './CapabilityEngine.js';

export interface ToolCallRequest {
  tool: string;
  input: Record<string, unknown>;
  /** Hint: 'mcp:<serverId>' or 'builtin' */
  backend?: string;
}

export interface ToolCallResponse {
  tool: string;
  backend: string;
  output: unknown;
  durationMs: number;
  error?: string;
}

type BuiltinHandlerFn = (input: Record<string, unknown>) => Promise<unknown>;

export class ToolOrchestrator {
  private readonly builtins = new Map<string, BuiltinHandlerFn>();
  private readonly log: ToolCallResponse[] = [];
  private readonly MAX_LOG = 500;

  constructor(
    private readonly mcpRuntime: MCPRuntime,
    private readonly capabilityEngine: CapabilityEngine,
    _eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  public registerBuiltin(toolName: string, handler: BuiltinHandlerFn): void {
    this.builtins.set(toolName, handler);
  }

  public async call(request: ToolCallRequest): Promise<ToolCallResponse> {
    const start = Date.now();

    // Built-in handler
    if (this.builtins.has(request.tool) && (!request.backend || request.backend === 'builtin')) {
      try {
        const output = await this.builtins.get(request.tool)!(request.input);
        const response: ToolCallResponse = {
          tool: request.tool, backend: 'builtin', output, durationMs: Date.now() - start,
        };
        this.record(response);
        return response;
      } catch (err) {
        const response: ToolCallResponse = {
          tool: request.tool, backend: 'builtin', output: null,
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
        this.record(response);
        return response;
      }
    }

    // MCP tool call
    const mcpMatch = this.resolveMCPBackend(request);
    if (mcpMatch) {
      const mcpCall: MCPToolCall = {
        serverId: mcpMatch,
        toolName: request.tool,
        input: request.input,
      };
      const result: MCPToolResult = await this.mcpRuntime.callTool(mcpCall);
      const response: ToolCallResponse = {
        tool: request.tool,
        backend: `mcp:${mcpMatch}`,
        output: result.output,
        durationMs: result.durationMs,
        error: result.error,
      };
      this.record(response);
      return response;
    }

    // Unknown — report capabilities for discovery
    const snap = this.capabilityEngine.snapshot();
    const response: ToolCallResponse = {
      tool: request.tool,
      backend: 'unknown',
      output: null,
      durationMs: Date.now() - start,
      error: `Tool "${request.tool}" not found. Available: builtin (${[...this.builtins.keys()].join(', ')}), MCP (${snap.connectedMCPServers.join(', ')})`,
    };
    this.record(response);
    return response;
  }

  public getLog(): ToolCallResponse[] {
    return [...this.log];
  }

  // ─── Private ─────────────────────────────────────────────────────

  private resolveMCPBackend(request: ToolCallRequest): string | null {
    // Explicit backend hint: 'mcp:<serverId>'
    if (request.backend?.startsWith('mcp:')) {
      return request.backend.slice(4);
    }

    // Auto-resolve: find the first connected server that has this tool
    const allTools = this.mcpRuntime.getAvailableTools();
    const match = allTools.find(t => t.name === request.tool);
    return match?.serverId ?? null;
  }

  private record(response: ToolCallResponse): void {
    this.log.push(response);
    if (this.log.length > this.MAX_LOG) this.log.shift();
  }
}
