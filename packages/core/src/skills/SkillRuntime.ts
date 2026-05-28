/**
 * MetaCLI Core — Skill Runtime
 *
 * Manages the active skill lifecycle: loading, activating, deactivating, and
 * composing multiple active skills into a unified session context.
 * The runtime is the source of truth for "what is MetaCLI capable of right now."
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';
import { SkillRegistry, type SkillEntry, type SkillDefinition } from './SkillRegistry.js';

export interface ActiveSkillContext {
  activeSkillIds: string[];
  combinedSystemModifier: string;
  preferredProviders: string[];
  memoryNamespaces: string[];
  requiredMCPServers: string[];
}

export interface SkillActivationResult {
  skillId: string;
  success: boolean;
  reason?: string;
}

export class SkillRuntime {
  private readonly active = new Set<string>();

  constructor(
    private readonly registry: SkillRegistry,
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
  ) {}

  public async activate(skillId: string): Promise<SkillActivationResult> {
    const skill = this.registry.get(skillId);
    if (!skill) return { skillId, success: false, reason: `Skill "${skillId}" not found` };
    if (skill.status === 'error') return { skillId, success: false, reason: skill.errorMessage };

    this.registry.enable(skillId);
    this.active.add(skillId);

    await this.__eventBus?.emit('system:ready' as any, {
      message: `Skill activated: ${skill.name}`,
    });

    return { skillId, success: true };
  }

  public async deactivate(skillId: string): Promise<void> {
    this.registry.disable(skillId);
    this.active.delete(skillId);
  }

  public install(def: SkillDefinition): void {
    this.registry.install(def);
  }

  public remove(skillId: string): boolean {
    this.active.delete(skillId);
    return this.registry.remove(skillId);
  }

  /** Build the unified session context for all currently active skills. */
  public getActiveContext(): ActiveSkillContext {
    const activeSkills = [...this.active]
      .map(id => this.registry.get(id))
      .filter((s): s is SkillEntry => s !== undefined);

    const combinedSystemModifier = activeSkills
      .map(s => s.systemPromptModifier)
      .filter(Boolean)
      .join('\n\n');

    // Deduplicate providers, preserving priority order
    const seenProviders = new Set<string>();
    const preferredProviders: string[] = [];
    for (const skill of activeSkills) {
      for (const p of skill.preferredProviders) {
        if (!seenProviders.has(p)) { seenProviders.add(p); preferredProviders.push(p); }
      }
    }

    const requiredMCPServers = [...new Set(activeSkills.flatMap(s => s.requiredMCP ?? []))];
    const memoryNamespaces = activeSkills.map(s => s.memoryNamespace);

    return {
      activeSkillIds: [...this.active],
      combinedSystemModifier,
      preferredProviders,
      memoryNamespaces,
      requiredMCPServers,
    };
  }

  public getActiveSkills(): SkillEntry[] {
    return [...this.active]
      .map(id => this.registry.get(id))
      .filter((s): s is SkillEntry => s !== undefined);
  }

  public isActive(skillId: string): boolean {
    return this.active.has(skillId);
  }

  public listAll(): SkillEntry[] {
    return this.registry.getAll();
  }
}
