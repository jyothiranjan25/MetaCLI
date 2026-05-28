export const BRAIN_VERSION = '0.1.0';

export {
  BrainStore,
  type FileRecord,
  type SymbolRecord,
  type DependencyRecord,
  type ExecutionAudit,
  type MemoryRecord,
  type GraphNode,
  type GraphEdge,
} from './persistence/BrainStore.js';
export { AstSymbolIndexer, type ParseResult } from './indexing/AstSymbolIndexer.js';
export { WorkspaceScanner, type ScanOptions } from './indexing/WorkspaceScanner.js';
export { KeywordRetrievalEngine, type RetrievedContext } from './retrieval/KeywordRetrievalEngine.js';
export { MemoryManager } from './memory/MemoryManager.js';

// Advanced Brain Intelligence Subsystems
export { BrainEvolutionEngine } from './memory/BrainEvolutionEngine.js';
export { SessionCompactor } from './memory/SessionCompactor.js';
export { MemoryConfidenceEngine } from './memory/MemoryConfidenceEngine.js';
export { SemanticGraphIntelligence } from './persistence/SemanticGraphIntelligence.js';
export {
  ArchitectureTimelineEngine,
  type ArchitectureDecision,
} from './persistence/ArchitectureTimelineEngine.js';
export {
  SemanticProjectMapGenerator,
  type DomainNode,
} from './indexing/SemanticProjectMapGenerator.js';

