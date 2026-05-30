/**
 * MetaCLI Core — Public API
 *
 * Barrel export for @metacli/core package.
 */

// Runtime
export { GlobalStorage } from './runtime/GlobalStorage.js';
export { SetupManager, type SetupResult } from './runtime/SetupManager.js';
export { UpdateManager, type VersionInfo } from './runtime/UpdateManager.js';

// Events
export { EventBus, type EventHandler } from './events/EventBus.js';
export type { MetaCLIEvents } from './events/events.js';
export type {
  StreamEvent,
  UsageEstimate,
  RateLimitStatus,
  DetectionResult,
  AuthStatus,
  HealthStatus,
  AdapterCapabilities,
  PromptRequest,
  PromptResult,
  FallbackRecord,
  RoutingRequest,
  RoutingDecision,
  SessionRecord,
  PromptRecord,
} from './events/types.js';

// Orchestrator
export { Orchestrator, type AskOptions, type OrchestratedStreamEvent } from './orchestrator/Orchestrator.js';
export type { AIAdapter } from './orchestrator/adapter-types.js';
export {
  ProviderRouter,
  AllProvidersExhaustedError,
  type RequestOutcome,
  type ProviderHealth,
} from './orchestrator/ProviderRouter.js';
export { FallbackEngine, type FallbackOptions } from './orchestrator/FallbackEngine.js';
export type { ProviderTransport, TransportMode } from './orchestrator/transports/ProviderTransport.js';
export { ProviderSession } from './orchestrator/runtime/ProviderSession.js';
export { ProviderPool } from './orchestrator/runtime/ProviderPool.js';
export { ProviderRuntimeManager } from './orchestrator/runtime/ProviderRuntimeManager.js';
export { SessionRouter } from './orchestrator/runtime/SessionRouter.js';
export { SessionPersistenceEngine } from './orchestrator/runtime/SessionPersistenceEngine.js';
export { TokenAccountingEngine } from './orchestrator/runtime/TokenAccountingEngine.js';

// Config
export { ConfigLoader, ConfigValidationError } from './config/ConfigLoader.js';
export {
  MetaCLIConfigSchema,
  ProviderConfigSchema,
  RoutingConfigSchema,
  BrainConfigSchema,
  SecurityConfigSchema,
  type MetaCLIConfig,
  type ProviderConfig,
  type RoutingConfig,
  type BrainConfig,
  type SecurityConfig,
} from './config/schema.js';

// Session
export { SessionManager } from './session/SessionManager.js';

// Security
export { CommandAnalyzer, type CommandRisk, type RiskLevel } from './security/CommandAnalyzer.js';
export { GitSnapshotEngine } from './security/GitSnapshotEngine.js';
export { EnvironmentSanitizer } from './security/EnvironmentSanitizer.js';
export { PathGuard, PathBoundaryError } from './security/PathGuard.js';
export {
  ArchitectureDriftDetector,
  type ArchitectureRule,
  type DriftViolation,
  type DependencyLike,
} from './security/ArchitectureDriftDetector.js';

// Advanced Intelligence Subsystems
export {
  PromptCompiler,
  type CompileOptions,
  type CompiledPrompt,
} from './orchestrator/PromptCompiler.js';
export {
  ContextOptimizer,
  type TokenBudget,
  type ContextItem,
  type OptimizedContext,
} from './orchestrator/ContextOptimizer.js';
export {
  IntentClassifier,
  type IntentType,
  type IntentClassification,
} from './orchestrator/IntentClassifier.js';
export {
  ProviderBenchmarkEngine,
  type PerformanceMetrics,
} from './orchestrator/ProviderBenchmarkEngine.js';
export {
  PredictiveContextEngine,
} from './orchestrator/PredictiveContextEngine.js';
export {
  ReplayEngine,
  type ReplaySnapshot,
} from './orchestrator/ReplayEngine.js';
export {
  RetrievalExplainabilityEngine,
  type TraceReason,
} from './orchestrator/RetrievalExplainabilityEngine.js';
export {
  ActiveArchitectureIntelligence,
  type CouplingReport,
} from './security/ActiveArchitectureIntelligence.js';

// New Advanced Cognitive Subsystems
export {
  ContextBudgetEngine,
  type AllocatedContext,
} from './orchestrator/ContextBudgetEngine.js';
export {
  SemanticContextPrioritizer,
} from './orchestrator/SemanticContextPrioritizer.js';
export {
  IntentAwareRetrievalOrchestrator,
  type RetrievalResult,
} from './orchestrator/IntentAwareRetrievalOrchestrator.js';
export {
  AdaptiveOrchestrationEngine,
  type AdaptiveConfig,
} from './orchestrator/AdaptiveOrchestrationEngine.js';
export {
  ConversationContinuityEngine,
  type SessionContinuity,
} from './session/ConversationContinuityEngine.js';
export {
  EngineeringConfidenceEngine,
  type ConfidenceAssessment,
} from './cognitive/state/EngineeringConfidenceEngine.js';
export {
  RuntimePresenceEngine,
  type PresenceState,
} from './cognitive/presence/RuntimePresenceEngine.js';
export {
  RuntimeHealthEngine,
  type HealthReport,
} from './runtime/RuntimeHealthEngine.js';

// Cognitive Intelligence Layer
export {
  GhostEngineerRuntime,
  type GhostProposal,
} from './cognitive/ghost/GhostEngineerRuntime.js';
export {
  ReflectionEngine,
  type WorkflowReflection,
} from './cognitive/learning/ReflectionEngine.js';
export {
  PersonaEngine,
  type PersonaType,
  type PersonaConfig,
} from './cognitive/personas/PersonaEngine.js';

// Unified Cohesion & Trust Subsystems
export {
  CognitiveRuntimeLoop,
  type LoopState,
} from './cognitive/loop/CognitiveRuntimeLoop.js';
export {
  TrustAndConfidenceRuntime,
  type TrustReport,
} from './cognitive/state/TrustAndConfidenceRuntime.js';
export {
  SemanticDiffEngine,
  type SemanticImpactReport,
} from './cognitive/diff/SemanticDiffEngine.js';
export {
  EngineeringQueryRuntime,
  type QueryTrace,
} from './cognitive/search/EngineeringQueryRuntime.js';
export {
  SemanticWorkflowPlanner,
  type PlannedTaskNode,
  type WorkflowPlan,
} from './cognitive/planner/SemanticWorkflowPlanner.js';
export {
  MemoryReinforcementEngine,
  type ReinforcedMemory,
} from './cognitive/memory/MemoryReinforcementEngine.js';
export {
  AdaptiveEngineeringPersona,
  type ProjectMode,
  type PersonaAttributes,
} from './cognitive/personas/AdaptiveEngineeringPersona.js';
export {
  CognitiveTimelineRuntime,
  type EvolutionEvent,
} from './cognitive/timeline/CognitiveTimelineRuntime.js';

// Production Intelligence Refinement Layer
export {
  ProviderExecutionProfiles,
  type ProviderProfile,
  type ProviderAdaptation,
} from './orchestrator/ProviderExecutionProfiles.js';
export {
  CollaborativeProviderRuntime,
  type CollaborativeTask,
  type CollaborativeResult,
  type TaskExecutorFn,
  type WorkflowContext,
} from './orchestrator/CollaborativeProviderRuntime.js';
export {
  EngineeringExplainabilityRuntime,
  type DecisionTrace,
  type ExplainReport,
} from './orchestrator/EngineeringExplainabilityRuntime.js';
export {
  RecoveryIntelligenceEngine,
  type ExecutionCheckpoint,
  type RecoveryStrategy,
  type RecoveryDecision,
  type RecoveryResult,
} from './orchestrator/RecoveryIntelligenceEngine.js';
export {
  CognitivePerformanceRuntime,
  type PerformanceSnapshot,
  type LatencySample,
} from './orchestrator/CognitivePerformanceRuntime.js';
export {
  LiveEngineeringMonitor,
  type EngineeringHealthMetrics,
  type RiskAlert,
  type MonitorConfig,
} from './cognitive/LiveEngineeringMonitor.js';

// Persistent Semantic Cognition Runtime
export {
  ZeroExplorationRuntime,
  type RetrievalTier,
  type ZeroExplorationResult,
  type TierProvider,
  type ZeroExplorationConfig,
} from './orchestrator/ZeroExplorationRuntime.js';
export {
  ReasoningCache,
  type CacheKind,
  type CacheEntry,
  type CacheStats,
} from './orchestrator/ReasoningCache.js';
export {
  ConfidenceGatedRetrieval,
  type FileConfidence,
  type GatedRetrievalRequest,
  type GatedRetrievalResult,
} from './orchestrator/ConfidenceGatedRetrieval.js';
export {
  MinimalReasoningMode,
  type ReasoningDepth,
  type TaskClassification,
} from './orchestrator/MinimalReasoningMode.js';
export {
  TwoStageReasoningEngine,
  type Stage1Plan,
  type Stage2Result,
  type TwoStageResult,
  type Stage1Resolver,
  type Stage2Resolver,
} from './orchestrator/TwoStageReasoningEngine.js';
export {
  CognitiveBudgetEngine,
  type CognitiveBudget,
  type CognitiveBudgetUsage,
  type BudgetDecision,
} from './orchestrator/CognitiveBudgetEngine.js';
export {
  TokenAwareOrchestrator,
  type OrchestrationCandidate,
  type TokenAwareDecision,
} from './orchestrator/TokenAwareOrchestrator.js';
export {
  SemanticReuseEngine,
  type ReuseRecord,
  type ReuseLookup,
} from './orchestrator/SemanticReuseEngine.js';
export {
  TokenEfficiencyAnalytics,
  type TokenWasteKind,
  type TokenWasteEvent,
  type TokenEfficiencyReport,
} from './orchestrator/TokenEfficiencyAnalytics.js';
export {
  SemanticContextCompiler,
  type SemanticContextCompilerOptions,
  type CompiledSemanticContext,
} from './orchestrator/SemanticContextCompiler.js';
export {
  ProviderTokenProfiles,
  type ProviderId,
  type ProviderTokenProfile,
} from './orchestrator/ProviderTokenProfiles.js';
export {
  RetrievalValueRanker,
  type RetrievalValueSignals,
  type RankedContextItem,
} from './orchestrator/RetrievalValueRanker.js';
export {
  ContextDeduplicator,
  type DeduplicatedContext,
} from './orchestrator/ContextDeduplicator.js';
export {
  TokenBudgetAllocator,
  type BudgetAllocation,
} from './orchestrator/TokenBudgetAllocator.js';
export {
  HierarchicalCompressionRuntime,
  type ContextDetailLevel,
  type CompressionResult,
} from './orchestrator/HierarchicalCompressionRuntime.js';
export {
  IntentContextReducer,
  type ContextReductionPolicy,
} from './orchestrator/IntentContextReducer.js';
export {
  PromptShapeOptimizer,
  type PromptShape,
} from './orchestrator/PromptShapeOptimizer.js';
export {
  OutputDensityController,
  type OutputDensityMode,
} from './orchestrator/OutputDensityController.js';
export {
  PersistentSemanticMemory,
  type SemanticMemoryEntry,
} from './orchestrator/PersistentSemanticMemory.js';
export {
  ContextExpirationEngine,
  type ExpirableContext,
  type ExpirationDecision,
} from './orchestrator/ContextExpirationEngine.js';
export {
  TokenTelemetryRuntime,
  type TokenTelemetrySample,
  type ProviderTokenAnalytics,
  type TokenTelemetryReport,
} from './orchestrator/TokenTelemetryRuntime.js';

// Skills Ecosystem
export {
  SkillRegistry,
  type SkillDefinition,
  type SkillEntry,
  type SkillStatus,
  type RetrievalStrategy,
} from './skills/SkillRegistry.js';
export {
  SkillRuntime,
  type ActiveSkillContext,
  type SkillActivationResult,
} from './skills/SkillRuntime.js';
export {
  SkillMarketplace,
  type MarketplaceEntry,
  type SearchResult,
} from './skills/SkillMarketplace.js';
export {
  SkillMemoryManager,
  type SkillMemoryEntry,
  type SkillMemoryQuery,
} from './skills/SkillMemoryManager.js';
export {
  SkillAwareRetrieval,
  type SkillAwareRetrievalHints,
} from './skills/SkillAwareRetrieval.js';
export {
  SkillAwarePromptCompiler,
  type SkillEnrichedPrompt,
} from './skills/SkillAwarePromptCompiler.js';

// MCP Ecosystem
export {
  MCPRegistry,
  type MCPServerConfig,
  type MCPServerEntry,
  type MCPToolDescriptor,
  type MCPTransport,
  type MCPStatus,
} from './mcp/MCPRegistry.js';
export {
  MCPRuntime,
  type MCPToolCall,
  type MCPToolResult,
  type MCPTransportFn,
} from './mcp/MCPRuntime.js';
export {
  MCPDiscoveryEngine,
  type DiscoveredServer,
} from './mcp/MCPDiscoveryEngine.js';
export {
  MCPPermissionManager,
  type PermissionGrant,
} from './mcp/MCPPermissionManager.js';

// Capability & Tool Orchestration
export {
  CapabilityEngine,
  type CapabilitySnapshot,
} from './orchestrator/CapabilityEngine.js';
export {
  ToolOrchestrator,
  type ToolCallRequest,
  type ToolCallResponse,
} from './orchestrator/ToolOrchestrator.js';
