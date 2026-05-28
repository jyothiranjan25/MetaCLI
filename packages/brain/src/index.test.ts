import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { BrainStore } from './persistence/BrainStore.js';
import { AstSymbolIndexer } from './indexing/AstSymbolIndexer.js';
import { KeywordRetrievalEngine } from './retrieval/KeywordRetrievalEngine.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { ArchitectureTimelineEngine } from './persistence/ArchitectureTimelineEngine.js';
import { SemanticProjectMapGenerator } from './indexing/SemanticProjectMapGenerator.js';
import { SemanticGraphIntelligence } from './persistence/SemanticGraphIntelligence.js';
import { MemoryConfidenceEngine } from './memory/MemoryConfidenceEngine.js';
import { SessionCompactor } from './memory/SessionCompactor.js';
import { BrainEvolutionEngine } from './memory/BrainEvolutionEngine.js';

describe('MetaCLI Project Brain System', () => {
  const tempDir = path.resolve('./temp-brain-test');
  let store: BrainStore;

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    store = new BrainStore(tempDir);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('BrainStore (Persistence Layer)', () => {
    it('should initialize schema and tables', () => {
      const files = store.getAllFiles();
      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBe(0);
    });

    it('should save and delete file records', () => {
      store.saveFile({
        path: 'src/index.ts',
        hash: 'abc123hash',
        size: 512,
      });

      const file = store.getFile('src/index.ts');
      expect(file).toBeDefined();
      expect(file?.hash).toBe('abc123hash');
      expect(file?.size).toBe(512);

      store.deleteFile('src/index.ts');
      expect(store.getFile('src/index.ts')).toBeUndefined();
    });

    it('should cascade-delete symbols and dependencies when a file is deleted', () => {
      store.saveFile({ path: 'src/main.ts', hash: 'h1', size: 100 });
      store.saveSymbols([
        {
          name: 'MainClass',
          type: 'class',
          filePath: 'src/main.ts',
          startLine: 5,
          endLine: 20,
          isExported: true,
        },
      ]);
      store.saveDependencies([
        { sourcePath: 'src/main.ts', targetPath: 'src/utils.ts', type: 'import' },
      ]);

      expect(store.searchSymbols('MainClass').length).toBe(1);
      expect(store.getAllDependencies().length).toBe(1);

      // Delete source file
      store.deleteFile('src/main.ts');

      // Check cascade
      expect(store.searchSymbols('MainClass').length).toBe(0);
      expect(store.getAllDependencies().length).toBe(0);
    });

    it('should calculate importance scores from incoming dependencies', () => {
      store.saveFile({ path: 'src/a.ts', hash: 'h1', size: 10 });
      store.saveFile({ path: 'src/b.ts', hash: 'h2', size: 10 });
      store.saveFile({ path: 'src/c.ts', hash: 'h3', size: 10 });

      // both a and b import c (c has 2 incoming imports)
      store.saveDependencies([
        { sourcePath: 'src/a.ts', targetPath: 'src/c.ts', type: 'import' },
        { sourcePath: 'src/b.ts', targetPath: 'src/c.ts', type: 'import' },
      ]);

      store.updateImportanceScores();

      const fileC = store.getFile('src/c.ts');
      expect(fileC?.importance).toBe(3); // 1 (base) + 2 (incoming) = 3
    });

    it('should save and retrieve execution audits successfully', () => {
      store.saveExecutionAudit({
        id: 'audit-123',
        command: 'npm install execa',
        providerId: 'claude-code',
        riskLevel: 'low',
        riskReason: 'whitelisted command',
        approvedBy: 'auto-policy',
        snapshotKey: 'backup-hash',
        status: 'success',
        durationMs: 1400,
        outputSnippet: 'added 1 package',
      });

      const audit = store.getExecutionAudit('audit-123');
      expect(audit).toBeDefined();
      expect(audit?.command).toBe('npm install execa');
      expect(audit?.riskLevel).toBe('low');
      expect(audit?.status).toBe('success');
      expect(audit?.durationMs).toBe(1400);

      const all = store.getAllExecutionAudits();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('audit-123');
    });

    it('should save, retrieve, and delete graph nodes and edges with cascaded deletes', () => {
      // 1. Create Nodes
      store.saveGraphNode({
        id: 'node-1',
        type: 'file',
        name: 'index.ts',
        properties: { size: 1024, lines: 50 },
      });
      store.saveGraphNode({
        id: 'node-2',
        type: 'symbol',
        name: 'calculateSum',
        properties: { type: 'function' },
      });

      // 2. Fetch and assert node
      const node1 = store.getGraphNode('node-1');
      expect(node1).toBeDefined();
      expect(node1?.type).toBe('file');
      expect(node1?.properties?.size).toBe(1024);

      const node2 = store.getGraphNode('node-2');
      expect(node2).toBeDefined();
      expect(node2?.name).toBe('calculateSum');

      // 3. Save Edge
      store.saveGraphEdge({
        sourceId: 'node-1',
        targetId: 'node-2',
        relation: 'declares',
        weight: 1.5,
      });

      // 4. Fetch and assert edges
      const edges = store.getGraphEdges('node-1');
      expect(edges.length).toBe(1);
      expect(edges[0].targetId).toBe('node-2');
      expect(edges[0].relation).toBe('declares');
      expect(edges[0].weight).toBe(1.5);

      // 5. Delete source node and verify cascade delete of the edge
      store.deleteGraphNode('node-1');
      expect(store.getGraphNode('node-1')).toBeUndefined();
      expect(store.getGraphEdges('node-1').length).toBe(0);

      // Node-2 should still exist
      expect(store.getGraphNode('node-2')).toBeDefined();
    });
  });

  describe('MemoryManager (Multi-tier Retrieval Engine)', () => {
    it('should support Hot/Warm/Cold memory addition and fetching', () => {
      const manager = new MemoryManager(store);

      manager.addMemory('hot', 'User asks for payment API setup');
      manager.addMemory('warm', 'Created payment.ts file and config details', {
        summary: 'payment milestones',
      });
      manager.addMemory('cold', 'Rule: Always use HTTPS endpoints for Stripe');

      const hot = manager.getMemories('hot');
      expect(hot.length).toBe(1);
      expect(hot[0].content).toBe('User asks for payment API setup');

      const warm = manager.getMemories('warm');
      expect(warm.length).toBe(1);
      expect(warm[0].summary).toBe('payment milestones');

      const cold = manager.getMemories('cold');
      expect(cold.length).toBe(1);
      expect(cold[0].content).toBe('Rule: Always use HTTPS endpoints for Stripe');
    });

    it('should retrieve memories by keyword relevance fallback search', () => {
      const manager = new MemoryManager(store);

      manager.addMemory('hot', 'User request for stripe gateway integration');
      manager.addMemory('hot', 'Setting up database index optimization');

      const results = manager.searchMemories('Stripe integration queries');
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('User request for stripe gateway integration');
    });

    it('should perform vector Cosine Similarity searches correctly', () => {
      const manager = new MemoryManager(store);

      manager.addMemory('cold', 'Node setup rules', {
        embedding: [1.0, 0.0, 0.0],
      });
      manager.addMemory('cold', 'Python setup rules', {
        embedding: [0.0, 1.0, 0.0],
      });

      // Query vector points towards Node rules ([1.0, 0.0, 0.0])
      const results = manager.searchMemories('looking for node rules', {
        queryEmbedding: [0.9, 0.1, 0.0],
        limit: 1,
      });

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Node setup rules');
    });
  });

  describe('AstSymbolIndexer (Code Intelligence Parsers)', () => {
    const indexer = new AstSymbolIndexer();

    it('should correctly parse symbols from TypeScript AST', () => {
      const code = `
        import { Config } from './config';
        export interface User {
          id: string;
        }
        export class UserManager {
          constructor() {}
          getUser() {}
        }
        export function registerUser(u: User): boolean {
          return true;
        }
        const helper = () => {};
        export const executeWorkflow = async () => {};
      `;
      const testFilePath = path.join(tempDir, 'user.ts');
      fs.writeFileSync(testFilePath, code);

      const result = indexer.parseFile(testFilePath, tempDir);

      expect(result.symbols).toBeInstanceOf(Array);
      
      const classSymbol = result.symbols.find((s) => s.name === 'UserManager');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.type).toBe('class');
      expect(classSymbol?.isExported).toBe(true);

      const interfaceSymbol = result.symbols.find((s) => s.name === 'User');
      expect(interfaceSymbol).toBeDefined();
      expect(interfaceSymbol?.type).toBe('interface');

      const funcSymbol = result.symbols.find((s) => s.name === 'registerUser');
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol?.type).toBe('function');

      const arrowSymbol = result.symbols.find((s) => s.name === 'executeWorkflow');
      expect(arrowSymbol).toBeDefined();
      expect(arrowSymbol?.type).toBe('function');
      expect(arrowSymbol?.isExported).toBe(true);
    });

    it('should run python fallback heuristics', () => {
      const code = `
import os
from sys import exit

class DatabaseHelper:
    def __init__(self):
        pass

def connect_db():
    return None
      `;
      const testFilePath = path.join(tempDir, 'db.py');
      fs.writeFileSync(testFilePath, code);

      const result = indexer.parseFile(testFilePath, tempDir);

      const classSym = result.symbols.find((s) => s.name === 'DatabaseHelper');
      expect(classSym?.type).toBe('class');

      const funcSym = result.symbols.find((s) => s.name === 'connect_db');
      expect(funcSym?.type).toBe('function');
    });

    it('should run go fallback heuristics', () => {
      const code = `
package main
import "fmt"

type Server struct {}

func RunServer() {}
      `;
      const testFilePath = path.join(tempDir, 'main.go');
      fs.writeFileSync(testFilePath, code);

      const result = indexer.parseFile(testFilePath, tempDir);

      const structSym = result.symbols.find((s) => s.name === 'Server');
      expect(structSym?.type).toBe('class');
      expect(structSym?.isExported).toBe(true); // capitalized

      const funcSym = result.symbols.find((s) => s.name === 'RunServer');
      expect(funcSym?.type).toBe('function');
      expect(funcSym?.isExported).toBe(true);
    });
  });

  describe('KeywordRetrievalEngine (Search & Context Builder)', () => {
    it('should retrieve relevant context and format markdown clickable links', () => {
      // 1. Populate DB
      store.saveFile({ path: 'src/utils/jwt.ts', hash: 'h1', size: 100 });
      store.saveSymbols([
        {
          name: 'verifyJwtToken',
          type: 'function',
          filePath: 'src/utils/jwt.ts',
          startLine: 10,
          endLine: 25,
          isExported: true,
        },
      ]);

      const engine = new KeywordRetrievalEngine(store, tempDir);
      
      // Query "how do I verify a jwt token?"
      const context = engine.retrieveContext('how do I verify a jwt token?');

      expect(context.files.length).toBe(1);
      expect(context.files[0].path).toBe('src/utils/jwt.ts');
      expect(context.symbols[0].name).toBe('verifyJwtToken');
      
      // Markdown link verify
      expect(context.markdown).toContain('[jwt.ts]');
      expect(context.markdown).toContain('verifyJwtToken');
      expect(context.markdown).toContain('L10-L25');
    });
  });

  describe('Advanced Brain Intelligence Layers', () => {
    it('should support timeline tracking, map generation, graph traversals, compactions, and confidence scoring', async () => {
      // 1. Architecture Decisions Timeline test
      const timelineEngine = new ArchitectureTimelineEngine(store);
      timelineEngine.recordDecision({
        system: 'Orchestrator',
        decision: 'Use priority fallbacks',
        rationale: 'Avoid rate limit blocks',
      });
      const timeline = timelineEngine.getTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0].system).toBe('Orchestrator');
      expect(timeline[0].rationale).toBe('Avoid rate limit blocks');

      // 2. Semantic Project Map Generator test
      const mapGenerator = new SemanticProjectMapGenerator();
      store.saveFile({ path: 'packages/core/src/auth/jwt.ts', hash: 'h1', size: 100 });
      store.saveFile({ path: 'packages/brain/src/persistence/sqlite.ts', hash: 'h2', size: 100 });
      store.saveFile({ path: 'apps/cli/src/ui/dashboard.tsx', hash: 'h3', size: 100 });
      
      const map = mapGenerator.generate(store);
      expect(map.children.length).toBe(3); // Auth, Persistence, and Presentation Domains
      expect(map.children[0].domainName).toBe('Auth Domain');

      // 3. Semantic Graph Traversals test
      store.saveGraphNode({ id: 'a', type: 'file', name: 'a' });
      store.saveGraphNode({ id: 'b', type: 'file', name: 'b' });
      store.saveGraphEdge({ sourceId: 'a', targetId: 'b', relation: 'imports', weight: 2.0 });

      const graphIntel = new SemanticGraphIntelligence(store);
      const order = graphIntel.traverseModuleTree('a');
      expect(order).toEqual(['a', 'b']);

      const coupling = graphIntel.inferServiceCoupling();
      expect(coupling['a']).toBe(2.0);

      // 4. Memory Confidence Engine test
      const confidenceEngine = new MemoryConfidenceEngine();
      const highlyReliable = confidenceEngine.evaluateConfidence({
        timestamp: new Date().toISOString(),
        importance: 10,
      });
      expect(highlyReliable).toBeCloseTo(1.0, 5); // clean fresh index has max reliability score

      const veryOldRecord = confidenceEngine.evaluateConfidence({
        timestamp: '2020-01-01T00:00:00Z',
        importance: 1,
      });
      expect(veryOldRecord).toBeLessThan(0.3); // faded decaying confidence index

      // 5. Session Compactor test
      const compactor = new SessionCompactor(store);
      store.saveMemory({ id: 'm1', layer: 'hot', content: 'A' });
      store.saveMemory({ id: 'm2', layer: 'hot', content: 'B' });
      store.saveMemory({ id: 'm3', layer: 'hot', content: 'C' });
      store.saveMemory({ id: 'm4', layer: 'hot', content: 'D' });
      store.saveMemory({ id: 'm5', layer: 'hot', content: 'E' });
      store.saveMemory({ id: 'm6', layer: 'hot', content: 'F' });

      await compactor.compact('sess-123');
      const hotList = store.getMemoriesByLayer('hot');
      expect(hotList.length).toBe(0); // cleared and compressed hot layer

      const warmList = store.getMemoriesByLayer('warm');
      expect(warmList.length).toBe(1);
      expect(warmList[0].content).toContain('Consolidated');

      // 6. Brain Evolution Engine test
      const evolutionEngine = new BrainEvolutionEngine(store);
      await evolutionEngine.evolveAfterPrompt('refactor sqlite schema', ['packages/brain/src/persistence/sqlite.ts']);
      
      const fileNode = store.getGraphNode('file:packages/brain/src/persistence/sqlite.ts');
      expect(fileNode).toBeDefined();
      expect(fileNode?.properties?.lastEvolvedReason).toContain('refactor sqlite schema');
    });
  });
});

