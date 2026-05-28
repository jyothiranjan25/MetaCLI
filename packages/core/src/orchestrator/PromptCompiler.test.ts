import { describe, it, expect } from 'vitest';
import { PromptCompiler } from './PromptCompiler.js';
import { ContextOptimizer } from './ContextOptimizer.js';
import { IntentClassifier } from './IntentClassifier.js';
import { ProviderBenchmarkEngine } from './ProviderBenchmarkEngine.js';
import { PredictiveContextEngine } from './PredictiveContextEngine.js';
import { ReplayEngine } from './ReplayEngine.js';
import { RetrievalExplainabilityEngine } from './RetrievalExplainabilityEngine.js';

describe('Advanced Intelligence - Core Orchestration', () => {
  it('should correctly classify user intent, rank context items, and compile prompt layouts', async () => {
    const optimizer = new ContextOptimizer();
    const classifier = new IntentClassifier();
    const compiler = new PromptCompiler(undefined, optimizer, classifier);

    // 1. Intent classifier tests
    const resRefactor = await classifier.classify('Can you refactor this messy module?');
    expect(resRefactor.primaryIntent).toBe('refactor');
    expect(resRefactor.confidence).toBeGreaterThan(0.5);

    const resDebug = await classifier.classify('How do I fix this null pointer issue?');
    expect(resDebug.primaryIntent).toBe('debug');

    // 2. Context budget optimizer tests
    const budget = { maxTokens: 100, reserveTokens: 10 };
    const items = [
      { path: 'src/a.ts', content: 'A'.repeat(160), importance: 10, relevanceScore: 0.9 }, // ~40 tokens
      { path: 'src/b.ts', content: 'B'.repeat(160), importance: 5, relevanceScore: 0.8 },  // ~40 tokens
      { path: 'src/c.ts', content: 'C'.repeat(160), importance: 1, relevanceScore: 0.1 },  // ~40 tokens
    ];

    const optimized = optimizer.optimize(items, budget, 'claude-code');
    expect(optimized.items.length).toBe(2); // Fits 2 items (80 tokens <= 90 tokens budget)
    expect(optimized.tokensSaved).toBeGreaterThan(0);
    expect(optimized.compressedSummary).toContain('src/c.ts');

    // 3. Prompt compiler integration tests
    const compiled = await compiler.compile('Can you refactor the security middleware?', {
      providerId: 'claude-code',
      contextItems: items,
    });

    expect(compiled.providerId).toBe('claude-code');
    expect(compiled.prompt).toContain('<context>');
    expect(compiled.prompt).toContain('Can you refactor the security middleware?');
    expect(compiled.systemInstructions?.toLowerCase()).toContain('refactor');
  });

  it('should specialize provider routing and log response metrics in BenchmarkEngine', () => {
    const engine = new ProviderBenchmarkEngine();
    
    // Track some metrics
    engine.trackResponse({ providerId: 'claude-code', latencyMs: 1200, success: true });
    engine.trackResponse({ providerId: 'gemini-cli', latencyMs: 400, success: true });

    expect(engine.getPreferredProvider('architecture')).toBe('claude-code');
    expect(engine.getPreferredProvider('debug')).toBe('gemini-cli');
  });

  it('should support trace explainability reports using RetrievalExplainabilityEngine', () => {
    const engine = new RetrievalExplainabilityEngine();
    const explanation = engine.explain(['src/auth/service.ts', 'src/auth/jwt.test.ts'], 'general');

    expect(explanation.length).toBe(2);
    expect(explanation[0].score).toBe(0.5);
    expect(explanation[1].rationale).toContain('testing context');
  });

  it('should persist deterministic inputs inside ReplayEngine', () => {
    const engine = new ReplayEngine();
    
    engine.saveSnapshot({
      sessionId: 'sess-abc',
      timestamp: new Date().toISOString(),
      prompt: 'refactor database',
      contextSnapshot: {},
      providerResponses: ['Success'],
      envVariables: {},
    });

    const loaded = engine.loadSnapshot('sess-abc');
    expect(loaded).toBeDefined();
    expect(loaded?.prompt).toBe('refactor database');
  });
});
