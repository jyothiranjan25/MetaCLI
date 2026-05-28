/**
 * MetaCLI Core — Public API
 *
 * Barrel export for @metacli/core package.
 */

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

