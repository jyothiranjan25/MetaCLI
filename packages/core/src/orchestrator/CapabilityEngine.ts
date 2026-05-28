/**
 * MetaCLI Core — Capability Engine
 *
 * Single entry point that surfaces what MetaCLI can do right now: which
 * skills are active, which MCP servers are connected, and which providers
 * are healthy.  The orchestrator consults this to adapt routing, retrieval,
 * and prompt compilation without knowing the internals of any subsystem.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import type { SkillRuntime } from '../skills/SkillRuntime.js';
import type { MCPRuntime } from '../mcp/MCPRuntime.js';

export interface CapabilitySnapshot {
  activeSkillIds: string[];
  connectedMCPServers: string[];
  availableToolCount: number;
  preferredProviders: string[];
  systemModifier: string;
  memoryNamespaces: string[];
  hasExternalContext: boolean;
}

export class CapabilityEngine {
  constructor(
    private readonly skillRuntime: SkillRuntime,
    private readonly mcpRuntime: MCPRuntime,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  /** Build a fresh snapshot of current capabilities. */
  public snapshot(): CapabilitySnapshot {
    const skillCtx = this.skillRuntime.getActiveContext();
    const mcpStatus = this.mcpRuntime.getStatus();
    const connectedMCP = mcpStatus.filter(s => s.status === 'connected').map(s => s.id);
    const availableToolCount = this.mcpRuntime.getAvailableTools().length;

    return {
      activeSkillIds: skillCtx.activeSkillIds,
      connectedMCPServers: connectedMCP,
      availableToolCount,
      preferredProviders: skillCtx.preferredProviders,
      systemModifier: skillCtx.combinedSystemModifier,
      memoryNamespaces: skillCtx.memoryNamespaces,
      hasExternalContext: connectedMCP.length > 0 || skillCtx.activeSkillIds.length > 0,
    };
  }

  /**
   * Auto-activate skills whose required MCP servers are connected.
   * Called after each MCP connection event.
   */
  public async reconcileSkillsWithMCP(): Promise<void> {
    const connectedIds = this.mcpRuntime.getStatus()
      .filter(s => s.status === 'connected')
      .map(s => s.id);

    for (const skill of this.skillRuntime.listAll()) {
      if (skill.status === 'enabled') continue;
      const required = skill.requiredMCP ?? [];
      if (required.length > 0 && required.every(id => connectedIds.includes(id))) {
        await this.skillRuntime.activate(skill.id);
        await this.__eventBus?.emit('system:ready' as any, {
          message: `Auto-activated skill "${skill.name}" (MCP ready)`,
        });
      }
    }
  }

  public describeCapabilities(): string {
    const snap = this.snapshot();
    const lines: string[] = ['## Active Capabilities'];

    if (snap.activeSkillIds.length > 0) {
      lines.push(`Skills: ${snap.activeSkillIds.join(', ')}`);
    }
    if (snap.connectedMCPServers.length > 0) {
      lines.push(`MCP: ${snap.connectedMCPServers.join(', ')} (${snap.availableToolCount} tools)`);
    }
    if (snap.preferredProviders.length > 0) {
      lines.push(`Preferred providers: ${snap.preferredProviders.join(' → ')}`);
    }
    if (lines.length === 1) lines.push('No skills or MCP connections active.');

    return lines.join('\n');
  }
}
