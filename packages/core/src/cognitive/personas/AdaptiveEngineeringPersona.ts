/**
 * MetaCLI Core — Adaptive Engineering Persona
 *
 * Dynamically configures risk thresholds, prompt styles, and architectural
 * coverage standards depending on development profiles (e.g. Startup vs Enterprise).
 */

export type ProjectMode = 'Startup' | 'Enterprise' | 'Performance' | 'Security';

export interface PersonaAttributes {
  mode: ProjectMode;
  systemModifier: string;
  riskTolerance: number;
  retrievalStrategy: 'broad' | 'deep' | 'precise';
}

export class AdaptiveEngineeringPersona {
  private eventBus: any;

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Activates a specific development mode override context.
   */
  activateMode(mode: ProjectMode): PersonaAttributes {
    const maps: Record<ProjectMode, Omit<PersonaAttributes, 'mode'>> = {
      Startup: {
        systemModifier: 'You are a startup hacker. Optimize for speed of implementation and fast iteration.',
        riskTolerance: 0.85,
        retrievalStrategy: 'broad',
      },
      Enterprise: {
        systemModifier: 'You are a principal enterprise architect. Optimize for solid interfaces, clean couplings, and 100% test coverage.',
        riskTolerance: 0.15,
        retrievalStrategy: 'deep',
      },
      Performance: {
        systemModifier: 'You are a latency and CPU performance specialist. Minimize structural allocations and context weights.',
        riskTolerance: 0.45,
        retrievalStrategy: 'broad',
      },
      Security: {
        systemModifier: 'You are a rigorous security auditor. Enforce sandboxes and sweep variables block bounds.',
        riskTolerance: 0.05,
        retrievalStrategy: 'precise',
      },
    };

    const config = maps[mode] ?? maps.Startup;
    const finalAttributes = { mode, ...config };

    if (this.eventBus) {
      this.eventBus.emit('persona.activated', finalAttributes);
    }

    return finalAttributes;
  }
}
