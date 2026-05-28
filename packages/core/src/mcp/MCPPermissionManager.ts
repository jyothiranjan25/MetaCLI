/**
 * MetaCLI Core — MCP Permission Manager
 *
 * Per-server, per-tool permission scoping.  A tool call is allowed only if
 * the server has been granted the scope that tool requires.  Permission grants
 * are session-scoped by default; they can be persisted by the caller.
 */

export interface PermissionGrant {
  serverId: string;
  /** Allowed tool name patterns ('*' = wildcard) */
  allowedTools: string[];
  grantedAt: number;
  expiresAt?: number;
}

export class MCPPermissionManager {
  private readonly grants = new Map<string, PermissionGrant>();

  public grant(serverId: string, allowedTools: string[], expiresInMs?: number): void {
    this.grants.set(serverId, {
      serverId,
      allowedTools,
      grantedAt: Date.now(),
      expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
    });
  }

  public revoke(serverId: string): void {
    this.grants.delete(serverId);
  }

  public isAllowed(serverId: string, toolName: string): boolean {
    const grant = this.grants.get(serverId);
    if (!grant) return false;
    if (grant.expiresAt && Date.now() > grant.expiresAt) {
      this.grants.delete(serverId);
      return false;
    }
    return grant.allowedTools.some(pattern =>
      pattern === '*' || pattern === toolName || this.matchGlob(pattern, toolName),
    );
  }

  public getGrant(serverId: string): PermissionGrant | undefined {
    return this.grants.get(serverId);
  }

  public listGrants(): PermissionGrant[] {
    return [...this.grants.values()];
  }

  private matchGlob(pattern: string, name: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(name);
  }
}
