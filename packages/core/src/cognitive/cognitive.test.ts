import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/events/EventBus.js';
import {
  GhostEngineerRuntime,
  ReflectionEngine,
  PersonaEngine,
  ContextBudgetEngine,
  SemanticContextPrioritizer,
  IntentAwareRetrievalOrchestrator,
  ConversationContinuityEngine,
  EngineeringConfidenceEngine,
  AdaptiveOrchestrationEngine,
  RuntimePresenceEngine,
  RuntimeHealthEngine,
  CognitiveRuntimeLoop,
  TrustAndConfidenceRuntime,
  SemanticDiffEngine,
  EngineeringQueryRuntime,
  SemanticWorkflowPlanner,
  MemoryReinforcementEngine,
  AdaptiveEngineeringPersona,
  CognitiveTimelineRuntime,
} from '../../src/index.js';

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

  it('ContextBudgetEngine should properly slice and allocated item token limits', () => {
    const engine = new ContextBudgetEngine(eventBus);
    const items = [
      { path: 'a.ts', content: 'const x = 1;', importance: 0.9, relevanceScore: 0.9 },
      { path: 'b.ts', content: 'const y = 2;', importance: 0.8, relevanceScore: 0.8 },
    ];
    const budget = { maxTokens: 10, reserveTokens: 2 }; // targetLimit = 8 tokens
    const result = engine.allocate(items, budget, 'claude-code');
    expect(result.items.length).toBe(2);
    expect(result.totalEstimatedTokens).toBeGreaterThan(0);
  });

  it('SemanticContextPrioritizer should sort context items with couplings boost factors', () => {
    const engine = new SemanticContextPrioritizer(eventBus);
    const items = [
      { path: 'a.ts', content: 'x', importance: 0.5, relevanceScore: 0.5 },
      { path: 'b.ts', content: 'y', importance: 0.5, relevanceScore: 0.5 },
    ];
    const prioritized = engine.prioritize(items, ['a.ts'], 'refactor');
    expect(prioritized[0]?.path).toBe('a.ts');
    expect(prioritized[0]?.relevanceScore).toBeGreaterThan(0.5);
  });

  it('IntentAwareRetrievalOrchestrator should switch active search strategies based on intents', async () => {
    const engine = new IntentAwareRetrievalOrchestrator(eventBus);
    const items = [
      { path: 'a.ts', content: 'x', importance: 0.5, relevanceScore: 0.5 },
    ];
    const result = await engine.retrieveContext('query', items, 'refactor', ['a.ts']);
    expect(result.strategyUsed).toContain('Topological Couplings');
    expect(result.items.length).toBe(1);
  });

  it('ConversationContinuityEngine should restore cross-session timelines and checkpoint states', async () => {
    const engine = new ConversationContinuityEngine(eventBus);
    const continuity = await engine.restoreContinuity('/workspace');
    expect(continuity.activeSessionId).toBeDefined();

    await engine.checkpointState(['file.ts'], 'wf-1');
    const checked = engine.getContinuity();
    expect(checked?.lastKnownFiles).toContain('file.ts');
    expect(checked?.activeWorkflowId).toBe('wf-1');
  });

  it('EngineeringConfidenceEngine should compute caution indices for stale contexts', () => {
    const engine = new EngineeringConfidenceEngine(eventBus);
    const highConf = engine.assessConfidence(5, [1000], 0.98);
    expect(highConf.score).toBe(1.0);

    const lowConf = engine.assessConfidence(0, [86400000 * 10], 0.6);
    expect(lowConf.score).toBeLessThan(0.6);
  });

  it('AdaptiveOrchestrationEngine should calculate adapter routes depending on task complexities', async () => {
    const engine = new AdaptiveOrchestrationEngine(eventBus);
    const config = await engine.adapt('high', 'refactor', 0);
    expect(config.providerId).toBe('claude-code');
    expect(config.enableGitSnapshots).toBe(true);
    expect(config.tokenMaxLimit).toBe(8000);
  });

  it('RuntimePresenceEngine should emit active footnotes and build welcome greetings', () => {
    const engine = new RuntimePresenceEngine(eventBus);
    const greeting = engine.greetContextually(10, 5);
    expect(greeting).toContain('MetaCLI is active.');

    const state = engine.emitFootnote('Compacted active brain SQLite tables');
    expect(state.activityText).toBe('Compacted active brain SQLite tables');
  });

  it('RuntimeHealthEngine should diagnose index drift and provider connectivity issues', async () => {
    const engine = new RuntimeHealthEngine(eventBus);
    const healthy = await engine.checkHealth(100, ['claude-code'], 200);
    expect(healthy.isStable).toBe(true);

    const sick = await engine.checkHealth(0, [], 5000);
    expect(sick.isStable).toBe(false);
    expect(sick.recommendations.length).toBeGreaterThan(1);
  });

  it('CognitiveRuntimeLoop should coordinate prompts state transitions successfully', () => {
    const loop = new CognitiveRuntimeLoop(eventBus);
    expect(loop.getState()).toBe('OBSERVING');
    loop.transition('CLASSIFYING');
    expect(loop.getState()).toBe('CLASSIFYING');
  });

  it('TrustAndConfidenceRuntime should evaluate index ages and provider failures', () => {
    const runtime = new TrustAndConfidenceRuntime(eventBus);
    const healthy = runtime.evaluateTrust(1000, 0, 0);
    expect(healthy.isTrustworthy).toBe(true);

    const stale = runtime.evaluateTrust(86400000 * 2, 2, 5);
    expect(stale.isTrustworthy).toBe(false);
    expect(stale.warnings.length).toBeGreaterThan(1);
  });

  it('SemanticDiffEngine should analyze exported boundaries changes', () => {
    const engine = new SemanticDiffEngine(eventBus);
    const report = engine.analyzeSemanticChanges('PathGuard.ts', 'export class PathGuard {}', 'class PathGuard {}');
    expect(report.structuralChanged).toBe(true);
    expect(report.riskScore).toBeGreaterThan(0.5);
  });

  it('EngineeringQueryRuntime should explore logical AST dependency linkages', async () => {
    const runtime = new EngineeringQueryRuntime(eventBus);
    const relationshipMatrix = {
      Orchestrator: ['ProviderRouter', 'FallbackEngine'],
    };
    const traces = await runtime.exploreQuery('Orchestrator', relationshipMatrix);
    expect(traces.length).toBe(1);
    expect(traces[0]?.relationships).toContain('ProviderRouter');
  });

  it('SemanticWorkflowPlanner should plan goal decomposition into DAG node graphs', () => {
    const planner = new SemanticWorkflowPlanner(eventBus);
    const plan = planner.planWorkflow('Migrate auth session structures');
    expect(plan.estimatedDifficulty).toBe('high');
    expect(plan.nodes.length).toBe(3);
    expect(plan.nodes[0]?.id).toBe('step-arch');
  });

  it('MemoryReinforcementEngine should calculate decay coefficients and touched boosts', () => {
    const engine = new MemoryReinforcementEngine(eventBus);
    const reinforced = engine.reinforceMemory('mem-1', 0.5, 10, 1);
    expect(reinforced.reinforced).toBe(true);
    expect(reinforced.confidence).toBeGreaterThan(0.5);

    const decayed = engine.reinforceMemory('mem-2', 0.8, 1, 10);
    expect(decayed.reinforced).toBe(false);
    expect(decayed.confidence).toBeLessThan(0.8);
  });

  it('AdaptiveEngineeringPersona should activate custom project modes risk limits', () => {
    const persona = new AdaptiveEngineeringPersona(eventBus);
    const enterprise = persona.activateMode('Enterprise');
    expect(enterprise.mode).toBe('Enterprise');
    expect(enterprise.riskTolerance).toBe(0.15);
    expect(enterprise.retrievalStrategy).toBe('deep');
  });

  it('CognitiveTimelineRuntime should build evolution overlays snapshots', () => {
    const runtime = new CognitiveTimelineRuntime(eventBus);
    const list = runtime.compileTimeline([
      { category: 'orchestration', description: 'Routed Claude' },
    ]);
    expect(list.length).toBe(1);
    expect(list[0]?.category).toBe('orchestration');
  });
});
