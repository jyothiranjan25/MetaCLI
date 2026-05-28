/**
 * MetaCLI Core — Skill Marketplace
 *
 * Discovers and installs skills from two sources:
 *   1. Local  — ~/.metacli/skills/<id>/skill.json
 *   2. Remote — a versioned skill catalog (pluggable via registerCatalogFetcher)
 *
 * The marketplace is intentionally offline-first: remote catalog fetching is
 * opt-in and never blocks local skill loading.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SkillDefinition } from './SkillRegistry.js';

export interface MarketplaceEntry {
  definition: SkillDefinition;
  source: 'local' | 'remote';
  installedLocally: boolean;
}

export interface SearchResult {
  entries: MarketplaceEntry[];
  totalFound: number;
  source: 'local' | 'remote' | 'both';
}

type CatalogFetcherFn = (query: string) => Promise<SkillDefinition[]>;

export class SkillMarketplace {
  private readonly localSkillsDir: string;
  private catalogFetcher: CatalogFetcherFn | null = null;

  constructor(localSkillsDir?: string) {
    this.localSkillsDir = localSkillsDir ?? join(homedir(), '.metacli', 'skills');
  }

  public registerCatalogFetcher(fn: CatalogFetcherFn): void {
    this.catalogFetcher = fn;
  }

  public async search(query: string): Promise<SearchResult> {
    const localEntries = this.scanLocal(query);
    const remoteEntries = this.catalogFetcher
      ? await this.fetchRemote(query)
      : [];

    const allEntries = [...localEntries, ...remoteEntries];
    const source = localEntries.length > 0 && remoteEntries.length > 0 ? 'both'
      : remoteEntries.length > 0 ? 'remote' : 'local';

    return { entries: allEntries, totalFound: allEntries.length, source };
  }

  public scanLocal(filter?: string): MarketplaceEntry[] {
    if (!existsSync(this.localSkillsDir)) return [];

    const entries: MarketplaceEntry[] = [];

    try {
      for (const dir of readdirSync(this.localSkillsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const manifestPath = join(this.localSkillsDir, dir.name, 'skill.json');
        if (!existsSync(manifestPath)) continue;

        try {
          const def = JSON.parse(readFileSync(manifestPath, 'utf-8')) as SkillDefinition;
          if (filter && !this.matchesFilter(def, filter)) continue;
          entries.push({ definition: def, source: 'local', installedLocally: true });
        } catch {
          // Skip malformed manifests
        }
      }
    } catch {
      // Directory unreadable
    }

    return entries;
  }

  public getLocalManifestPath(skillId: string): string {
    return join(this.localSkillsDir, skillId, 'skill.json');
  }

  // ─── Private ─────────────────────────────────────────────────────

  private async fetchRemote(query: string): Promise<MarketplaceEntry[]> {
    if (!this.catalogFetcher) return [];
    try {
      const defs = await this.catalogFetcher(query);
      return defs.map(def => ({ definition: def, source: 'remote' as const, installedLocally: false }));
    } catch {
      return [];
    }
  }

  private matchesFilter(def: SkillDefinition, filter: string): boolean {
    const q = filter.toLowerCase();
    return (
      def.id.includes(q) ||
      def.name.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q) ||
      def.categories.some(c => c.includes(q))
    );
  }
}
