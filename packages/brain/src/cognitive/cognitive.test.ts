import { describe, it, expect } from 'vitest';
import { EventBus } from '@metacli/core';
import {
  DeveloperDNAEngine,
  TemporalEngineeringAnalyzer,
  RepositorySimulationEngine,
  EngineeringStateAnalyzer,
  RefactorSafetyEngine,
  ThreatDetectionEngine,
  ProjectNarrativeEngine,
  SemanticRepositorySearchEngine,
  EngineeringReasoningEngine,
  SelfCuratingBrainEngine,
  KnowledgeDistillationEngine,
  DistributedSynchronizationEngine,
  StrategicProjectUnderstandingEngine,
  ArchitectureGraphRuntime,
  HierarchicalCompressionEngine,
  FailureLearningEngine,
  ArchitectureSnapshotEngine,
} from '../../src/index.js';

describe('MetaCLI Brain Cognitive Intelligence Layer', () => {
  const eventBus = new EventBus<any>();

  it('DeveloperDNAEngine should observe stylistic interactions and learn DNA profiles', async () => {
    const engine = new DeveloperDNAEngine(eventBus);
    const dnaBefore = await engine.getActiveDNA();
    expect(dnaBefore.confidence).toBe(0.5);

    await engine.observeInteraction(
      'function test() { console.log("hi") }',
      'function test() { console.log("hi"); }; const val = 3;'
    );

    const dnaAfter = await engine.getActiveDNA();
    expect(dnaAfter.confidence).toBeGreaterThan(0.5);
    expect(dnaAfter.preferences.semicolons).toBe('true');
    expect(dnaAfter.learnedPatterns).toContain('Uses semicolons explicitly');
  });

  it('TemporalEngineeringAnalyzer should analyze complexity trend forecasts', async () => {
    const engine = new TemporalEngineeringAnalyzer(eventBus);
    const trend = await engine.analyzeTrend('auth', 30);
    expect(trend._moduleId).toBe('auth');
    expect(trend.trendDirection).toBe('increasing');
    expect(trend.acceleration).toBe(1.5);
  });

  it('RepositorySimulationEngine should simulate change blast radius', async () => {
    const engine = new RepositorySimulationEngine(eventBus);
    const report = await engine.simulateImpact('packages/core/src/auth/Service.ts', 'delete');
    expect(report.targetNodeId).toBe('packages/core/src/auth/Service.ts');
    expect(report.riskScore).toBe(0.85);
    expect(report.directImpacts).toContain('packages/core/src/security/PathGuard.ts');
  });

  it('EngineeringStateAnalyzer should correctly categorize developer mood state', () => {
    const engine = new EngineeringStateAnalyzer(eventBus);
    const stateFlow = engine.analyzeSessionState([]);
    expect(stateFlow).toBe('flow');

    const stateFrustrated = engine.analyzeSessionState([
      { type: 'test.failed' },
      { type: 'test.failed' },
      { type: 'test.failed' },
    ]);
    expect(stateFrustrated).toBe('frustrated');
  });

  it('RefactorSafetyEngine should evaluate change proposals for safety factors', async () => {
    const engine = new RefactorSafetyEngine(eventBus);
    const safeResult = await engine.evaluateProposalSafety('plan-1', 'const val = 1;');
    expect(safeResult.isSafe).toBe(true);
    expect(safeResult.confidenceScore).toBe(0.92);

    const riskyResult = await engine.evaluateProposalSafety('plan-2', 'delete security auth key');
    expect(riskyResult.isSafe).toBe(false);
    expect(riskyResult.riskFactors.length).toBeGreaterThan(0);
  });

  it('ThreatDetectionEngine should identify circular modular anti-patterns', async () => {
    const engine = new ThreatDetectionEngine(eventBus);
    const threats = await engine.scanForThreats(['apps/cli/src/index.ts']);
    expect(threats.length).toBe(1);
    expect(threats[0]?.severity).toBe('high');
    expect(threats[0]?.suggestedMitigation).toBeDefined();
  });

  it('ProjectNarrativeEngine should generate narrative timeline summaries', async () => {
    const engine = new ProjectNarrativeEngine(eventBus);
    const epoch = await engine.generateNarrativeEpoch(1000, 2000);
    expect(epoch.epochId).toBeDefined();
    expect(epoch.keyDecisions.length).toBeGreaterThan(0);
  });

  it('SemanticRepositorySearchEngine should execute hybrid intent indexing queries', async () => {
    const engine = new SemanticRepositorySearchEngine(eventBus);
    const res = await engine.executeQuery('search for secure path guard sandboxes');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]?.__nodeId).toBe('packages/core/src/security/PathGuard.ts');
    expect(res[0]?.matchType).toBe('semantic');
  });

  it('EngineeringReasoningEngine should semantically extract design rationale', async () => {
    const engine = new EngineeringReasoningEngine(eventBus);
    const intent = await engine.extractIntent('refactor: introduce path boundary controls', { symbols: ['PathGuard'] });
    expect(intent.type).toBe('architectural');
    expect(intent.rational).not.toBeNull();
    expect(intent.associatedSymbols).toContain('PathGuard');
  });

  it('SelfCuratingBrainEngine should critique and decaying stale memory values', async () => {
    const engine = new SelfCuratingBrainEngine(eventBus);
    const fresh = await engine.validateMemory('mem-fresh');
    expect(fresh.isStale).toBe(false);
    expect(fresh.confidenceScore).toBe(0.96);

    const stale = await engine.validateMemory('mem-stale-record');
    expect(stale.isStale).toBe(true);
    expect(stale.confidenceScore).toBe(0.24);
  });

  it('KnowledgeDistillationEngine should compile living documentation specs', async () => {
    const engine = new KnowledgeDistillationEngine(eventBus);
    const doc = await engine.distillNode('packages/core/src/auth');
    expect(doc.docId).toBeDefined();
    expect(doc.markdownContent).toContain('# Architectural Spec');
    expect(doc.diagrams.length).toBe(1);
  });

  it('DistributedSynchronizationEngine should reconcile shared team delta logs', async () => {
    const engine = new DistributedSynchronizationEngine(eventBus);
    const status = await engine.synchronize();
    expect(status.status).toBe('idle');
    expect(status.lastSyncTime).toBeGreaterThan(0);
  });

  it('StrategicProjectUnderstandingEngine should deduce macroeconomic theme directives', async () => {
    const engine = new StrategicProjectUnderstandingEngine(eventBus);
    const directives = await engine.evaluateMacroTrends();
    expect(directives.length).toBe(2);
    expect(directives[0]?.theme).toBe('Distributed Brain Sync');
  });

  it('ArchitectureGraphRuntime should partition visualization layouts viewport slices', async () => {
    const engine = new ArchitectureGraphRuntime(eventBus);
    const viewport = await engine.getViewport('packages/brain/src/persistence/BrainStore.ts');
    expect(viewport.__centerNodeId).toBe('packages/brain/src/persistence/BrainStore.ts');
    expect(viewport.nodes.length).toBe(3);
    expect(viewport.edges.length).toBe(2);
  });

  it('HierarchicalCompressionEngine should roll up summary trees dynamically', async () => {
    const engine = new HierarchicalCompressionEngine(eventBus);
    const node = await engine.compressLevel(['file-a', 'file-b'], 'module');
    expect(node.level).toBe('module');
    expect(node.childIds).toContain('file-a');
  });

  it('FailureLearningEngine should construct defensive anti-patterns guidelines', async () => {
    const engine = new FailureLearningEngine(eventBus);
    const constraint = await engine.learnFromFailure('Ast compiler package crash', 'pnpm build');
    expect(constraint.antiPattern).toBe('Mixing workspace managers inside composite packages settings.');
  });

  it('ArchitectureSnapshotEngine should serialize graph networks topologies diffs', async () => {
    const engine = new ArchitectureSnapshotEngine(eventBus);
    const snap = await engine.createSnapshot('major_version_milestone');
    expect(snap.snapshotId).toBeDefined();
    expect(snap.nodeCount).toBe(38);

    const diff = await engine.diffSnapshots('snap-1', 'snap-2');
    expect(diff.snapshotA).toBe('snap-1');
    expect(diff.addedNodes).toContain('packages/core/src/cognitive/learning/ReflectionEngine.ts');
  });
});
