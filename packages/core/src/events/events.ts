/**
 * MetaCLI Core — Event Definitions
 *
 * All system-wide events are defined here with strict typing.
 * This serves as the contract between all MetaCLI subsystems.
 */

import type { StreamEvent, UsageEstimate } from './types.js';

export interface MetaCLIEvents {
  // Provider lifecycle events
  'provider:detected': { adapterId: string; version: string; binaryPath: string };
  'provider:auth_valid': { adapterId: string; method: string };
  'provider:auth_expired': { adapterId: string; error: string };
  'provider:rate_limited': { adapterId: string; retryAfter?: Date };
  'provider:healthy': { adapterId: string; score: number };
  'provider:unhealthy': { adapterId: string; reason: string };
  'provider:cooldown_start': { adapterId: string; until: Date };
  'provider:cooldown_end': { adapterId: string };

  // Prompt orchestration events
  'prompt:start': { promptId: string; provider: string; prompt: string };
  'prompt:stream': { promptId: string; event: StreamEvent };
  'prompt:complete': { promptId: string; provider: string; usage?: UsageEstimate };
  'prompt:fallback': { promptId: string; from: string; to: string; reason: string };
  'prompt:error': { promptId: string; error: string; provider: string };
  'prompt:abort': { promptId: string; reason: string };

  // Memory / Brain events
  'brain:scan_start': { projectPath: string };
  'brain:scan_progress': { phase: string; progress: number; detail?: string };
  'brain:scan_complete': { fileCount: number; symbolCount: number; durationMs: number };
  'brain:memory_updated': { tier: string; entriesChanged: number };
  'brain:compaction': { tier: string; before: number; after: number };

  // Advanced Intelligence Layer events
  'memory.updated': { tier: string; entriesChanged: number };
  'memory.compacted': { sessionId: string; durationMs: number };
  'retrieval.completed': { query: string; fileCount: number; latencyMs: number };
  'context.optimized': { providerId: string; tokensSaved: number };
  'provider.benchmarked': { providerId: string; latencyMs: number; success: boolean };
  'intent.detected': { prompt: string; intent: string; confidence: number };
  'graph.updated': { nodeCount: number; edgeCount: number };
  'architecture.evolved': { system: string; decision: string };
  'context.preloaded': { filePath: string; matchedSymbols: number };
  'session.replayed': { sessionId: string };
  'retrieval.explained': { matchCount: number };
  'architecture.analyzed': { circularCount: number };

  // Workflow events
  'workflow:start': { workflowId: string; name: string; stepCount: number };
  'workflow:step_start': { workflowId: string; stepId: string; provider: string };
  'workflow:step_complete': { workflowId: string; stepId: string; durationMs: number };
  'workflow:complete': { workflowId: string; durationMs: number };
  'workflow:error': { workflowId: string; stepId: string; error: string };

  // Session events
  'session:start': { sessionId: string; projectPath: string };
  'session:end': { sessionId: string; promptCount: number; durationMs: number };

  // System events
  'system:ready': { providers: string[]; projectPath: string };
  'system:error': { error: string; fatal: boolean };
}
