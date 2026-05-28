/**
 * MetaCLI Core — MCP Discovery Engine
 *
 * Discovers available MCP servers from three sources in priority order:
 *   1. Project-local   .metacli/mcp.json
 *   2. User-global     ~/.metacli/mcp.json
 *   3. Built-in        MCPRegistry defaults
 *
 * On discovery, checks which servers have credentials available in the
 * environment and marks them as auto-connectable.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { MCPServerConfig } from './MCPRegistry.js';

export interface DiscoveredServer {
  config: MCPServerConfig;
  source: 'project' | 'user' | 'builtin';
  credentialsAvailable: boolean;
  missingEnvVars: string[];
}

export class MCPDiscoveryEngine {
  constructor(
    private readonly projectRoot: string,
    private readonly builtinIds: string[] = [],
  ) {}

  public discover(): DiscoveredServer[] {
    const results: DiscoveredServer[] = [];
    const seen = new Set<string>();

    // 1. Project-local config
    for (const cfg of this.loadConfigFile(join(this.projectRoot, '.metacli', 'mcp.json'))) {
      if (!seen.has(cfg.id)) {
        seen.add(cfg.id);
        results.push(this.check(cfg, 'project'));
      }
    }

    // 2. User-global config
    for (const cfg of this.loadConfigFile(join(homedir(), '.metacli', 'mcp.json'))) {
      if (!seen.has(cfg.id)) {
        seen.add(cfg.id);
        results.push(this.check(cfg, 'user'));
      }
    }

    // 3. Builtins already in registry
    for (const id of this.builtinIds) {
      if (!seen.has(id)) {
        seen.add(id);
        results.push({
          config: { id, name: id, description: '', transport: 'stdio', requiredScopes: [], builtin: true },
          source: 'builtin',
          credentialsAvailable: false,
          missingEnvVars: [],
        });
      }
    }

    return results;
  }

  public getAutoConnectable(): DiscoveredServer[] {
    return this.discover().filter(s => s.credentialsAvailable);
  }

  // ─── Private ─────────────────────────────────────────────────────

  private loadConfigFile(path: string): MCPServerConfig[] {
    if (!existsSync(path)) return [];
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as { servers?: MCPServerConfig[] };
      return Array.isArray(raw.servers) ? raw.servers : [];
    } catch {
      return [];
    }
  }

  private check(config: MCPServerConfig, source: DiscoveredServer['source']): DiscoveredServer {
    const requiredVars = Object.keys(config.env ?? {});
    const missingEnvVars = requiredVars.filter(k => !process.env[k]);
    return {
      config,
      source,
      credentialsAvailable: missingEnvVars.length === 0,
      missingEnvVars,
    };
  }
}
