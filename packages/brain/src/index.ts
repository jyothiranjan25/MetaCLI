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
export {
  SemanticFileMapEngine,
  type SemanticFileMapEntry,
  type RiskClassification,
} from './indexing/SemanticFileMapEngine.js';
export {
  ArchitectureSummaryCompiler,
  type ArchitectureSummary,
} from './indexing/ArchitectureSummaryCompiler.js';
export {
  ColdStartPreprocessor,
  type ColdStartResult,
} from './indexing/ColdStartPreprocessor.js';
export {
  GraphDirectedRetrieval,
  type GraphRetrievalOptions,
  type GraphRetrievalResult,
} from './retrieval/GraphDirectedRetrieval.js';
export {
  SemanticWindowEngine,
  type SemanticWindowRequest,
  type SemanticWindow,
  type SourceReader,
} from './retrieval/SemanticWindowEngine.js';
export {
  ASTCompressionEngine,
  type ASTCompressedRegion,
} from './retrieval/ASTCompressionEngine.js';
export {
  SemanticDeltaEngine,
  type SemanticSnapshot,
  type SemanticDelta,
} from './retrieval/SemanticDeltaEngine.js';
export {
  DifferentialMemoryUpdater,
  type DifferentialUpdate,
} from './memory/DifferentialMemoryUpdater.js';

// Cognitive Intelligence Layer
export { EngineeringReasoningEngine, type ReasoningIntent } from './cognitive/reasoning/EngineeringReasoningEngine.js';
export { SelfCuratingBrainEngine, type MemoryMetadata } from './cognitive/memory/SelfCuratingBrainEngine.js';
export { RepositorySimulationEngine, type SimulationReport } from './cognitive/simulation/RepositorySimulationEngine.js';
export { TemporalEngineeringAnalyzer, type TemporalTrend } from './cognitive/analytics/TemporalEngineeringAnalyzer.js';
export { DeveloperDNAEngine, type DeveloperDNA } from './cognitive/adaptation/DeveloperDNAEngine.js';
export { HierarchicalCompressionEngine, type CompressedNode } from './cognitive/memory/HierarchicalCompressionEngine.js';
export { ArchitectureSnapshotEngine, type ArchitectureSnapshot } from './cognitive/memory/ArchitectureSnapshotEngine.js';
export { FailureLearningEngine, type FailureConstraint } from './cognitive/learning/FailureLearningEngine.js';
export { StrategicProjectUnderstandingEngine, type StrategicDirective } from './cognitive/narrative/StrategicProjectUnderstandingEngine.js';
export { KnowledgeDistillationEngine, type DistilledDocument } from './cognitive/distillation/KnowledgeDistillationEngine.js';
export { ThreatDetectionEngine, type ArchitecturalThreat } from './cognitive/threat/ThreatDetectionEngine.js';
export { RefactorSafetyEngine, type SafetyAssessment } from './cognitive/refactor/RefactorSafetyEngine.js';
export { ArchitectureGraphRuntime, type GraphViewport } from './cognitive/visualization/ArchitectureGraphRuntime.js';
export { EngineeringStateAnalyzer, type EngineeringState } from './cognitive/state/EngineeringStateAnalyzer.js';
export { ProjectNarrativeEngine, type NarrativeEpoch } from './cognitive/narrative/ProjectNarrativeEngine.js';
export { SemanticRepositorySearchEngine, type SearchResult } from './cognitive/search/SemanticRepositorySearchEngine.js';
export { DistributedSynchronizationEngine, type SyncStatus } from './cognitive/distributed/DistributedSynchronizationEngine.js';

// Production Intelligence Refinement Layer
export {
  MemoryGovernanceEngine,
  type GovernanceStats,
  type GovernanceConfig,
  type GovernanceBrainStore,
} from './memory/MemoryGovernanceEngine.js';
export {
  FederatedKnowledgeRuntime,
  type FederatedKnowledgeQuery,
  type FederatedKnowledgeEntry,
  type FederatedQueryResult,
} from './memory/FederatedKnowledgeRuntime.js';
export {
  RepositoryScalingRuntime,
  type SubGraph,
  type ScalingConfig,
} from './indexing/RepositoryScalingRuntime.js';
