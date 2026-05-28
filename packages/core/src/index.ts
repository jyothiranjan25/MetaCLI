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

