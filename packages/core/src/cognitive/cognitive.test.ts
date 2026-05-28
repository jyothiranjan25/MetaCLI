import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/events/EventBus.js';
import { GhostEngineerRuntime, ReflectionEngine, PersonaEngine } from '../../src/index.js';

describe('MetaCLI Core Cognitive Intelligence Layer', () => {
  const eventBus = new EventBus<any>();

  it('GhostEngineerRuntime should autonomously trigger background proposals', async () => {
    const runtime = new GhostEngineerRuntime(eventBus);
    const proposal = await runtime.generateProactiveProposal();
    expect(proposal).not.toBeNull();
    expect(proposal?.targetFiles).toContain('apps/cli/src/ui/overlays/HelpOverlay.tsx');
    expect(proposal?.estimatedRisk).toBe(0.15);
  });

  it('ReflectionEngine should reflect on completed workflow traces', async () => {
    const engine = new ReflectionEngine(eventBus);
    const successTrace = await engine.reflectOnWorkflow({ id: 'wf-1', success: true });
    expect(successTrace.success).toBe(true);
    expect(successTrace.providerPerformanceScore).toBe(0.95);

    const failureTrace = await engine.reflectOnWorkflow({ id: 'wf-2', success: false, retrievedFiles: Array(10).fill('f') });
    expect(failureTrace.success).toBe(false);
    expect(failureTrace.inefficientRetrievalKeys).toContain('unfiltered_glob_imports');
    expect(failureTrace.providerPerformanceScore).toBe(0.42);
  });

  it('PersonaEngine should map role modes to active orchestrator strategies', () => {
    const engine = new PersonaEngine(eventBus);
    
    const architect = engine.activatePersona('Architect');
    expect(architect.type).toBe('Architect');
    expect(architect.retrievalStrategy).toBe('deep');
    expect(architect.riskTolerance).toBe(0.2);

    const hacker = engine.activatePersona('Hacker');
    expect(hacker.type).toBe('Hacker');
    expect(hacker.retrievalStrategy).toBe('broad');
    expect(hacker.riskTolerance).toBe(0.9);
  });
});
