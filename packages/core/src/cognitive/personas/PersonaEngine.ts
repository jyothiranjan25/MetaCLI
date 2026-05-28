/**
 * META-CLI COGNITIVE INTELLIGENCE LAYER
 * System: Persona Engine
 * 
 * Predefined configurations mapping to AI system prompt modifiers and risk tolerances.
 */

import { EventBus } from '../../events/EventBus.js';

export type PersonaType = 'Architect' | 'Security' | 'Performance' | 'Hacker' | 'Default';

export interface PersonaConfig {
  type: PersonaType;
  systemPromptModifier: string;
  providerPreference: string;
  retrievalStrategy: 'broad' | 'deep' | 'precise';
  riskTolerance: number;
}

export class PersonaEngine {
  constructor(protected __eventBus: EventBus) {}

  /**
   * Activates a specific persona, returning the configuration overrides for the orchestrator.
   */
  public activatePersona(type: PersonaType): PersonaConfig {
    const configs: Record<PersonaType, Omit<PersonaConfig, 'type'>> = {
      Architect: {
        systemPromptModifier: 'You are a principal systems architect. Optimize for clean dependency coupling and solid design patterns.',
        providerPreference: 'claude-code',
        retrievalStrategy: 'deep',
        riskTolerance: 0.2,
      },
      Security: {
        systemPromptModifier: 'You are an aggressive security auditor. Enforce sandboxing and clean process environments strictly.',
        providerPreference: 'claude-code',
        retrievalStrategy: 'precise',
        riskTolerance: 0.05,
      },
      Performance: {
        systemPromptModifier: 'You are a latency and performance optimizer. Focus on caching and minimal CPU overheads.',
        providerPreference: 'gemini-cli',
        retrievalStrategy: 'broad',
        riskTolerance: 0.5,
      },
      Hacker: {
        systemPromptModifier: 'You are a startup hacker. Optimize for speed of implementation and fast iteration cycles.',
        providerPreference: 'gemini-cli',
        retrievalStrategy: 'broad',
        riskTolerance: 0.9,
      },
      Default: {
        systemPromptModifier: 'You are a helpful software engineering partner.',
        providerPreference: 'auto',
        retrievalStrategy: 'broad',
        riskTolerance: 0.5,
      },
    };

    const config = configs[type] ?? configs.Default;
    const finalConfig: PersonaConfig = {
      type,
      ...config,
    };

    this.__eventBus.emit('orchestration.strategy.updated' as any, finalConfig as any);

    return finalConfig;
  }
}
