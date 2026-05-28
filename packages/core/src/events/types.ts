/**
 * MetaCLI Core — Shared Type Definitions
 *
 * These types flow through the entire system: from adapters through
 * the orchestrator to the UI. They define the common language of MetaCLI.
 */

// ─── Stream Events ─────────────────────────────────────────────

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; result: unknown }
  | { type: 'error'; error: string; code?: string }
  | { type: 'rate_limit'; retryAfter?: number }
  | { type: 'done'; usage?: UsageEstimate };

// ─── Usage & Limits ─────────────────────────────────────────────

export interface UsageEstimate {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  remainingQuota?: number;
  windowResetAt?: Date;
}

export interface RateLimitStatus {
  limited: boolean;
  remainingRequests?: number;
  resetAt?: Date;
  windowDuration?: number;
}

// ─── Provider Detection & Health ────────────────────────────────

export interface DetectionResult {
  installed: boolean;
  binaryPath?: string;
  version?: string;
  configDir?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  method?: 'oauth' | 'api-key' | 'service-account' | 'config-file';
  expiresAt?: Date;
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  rateLimited: boolean;
  cooldownUntil?: Date;
  score: number; // 0-100, exponential moving average
  lastChecked: Date;
}

export interface AdapterCapabilities {
  supportsStreaming: boolean;
  supportsJsonOutput: boolean;
  supportsNonInteractive: boolean;
  supportsFileContext: boolean;
  requiresPty: boolean;
  authType: 'oauth' | 'api-key' | 'config-file' | 'mixed';
}

// ─── Prompt Request / Response ──────────────────────────────────

export interface PromptRequest {
  prompt: string;
  systemPrompt?: string;
  files?: string[];
  workingDirectory: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface PromptResult {
  promptId: string;
  provider: string;
  content: string;
  usage?: UsageEstimate;
  durationMs: number;
  fallbacks: FallbackRecord[];
}

export interface FallbackRecord {
  from: string;
  to: string;
  reason: string;
  timestamp: Date;
}

// ─── Routing ────────────────────────────────────────────────────

export interface RoutingRequest {
  prompt: string;
  preferredProvider?: string;
  excludeProviders?: string[];
  workflowRole?: string;
}

export interface RoutingDecision {
  adapterId: string;
  reason: string;
  score: number;
  alternatives: Array<{ adapterId: string; score: number }>;
}

// ─── Session ────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  projectPath: string;
  startedAt: Date;
  endedAt?: Date;
  prompts: PromptRecord[];
  touchedFiles: string[];
  decisions: string[];
}

export interface PromptRecord {
  id: string;
  provider: string;
  prompt: string;
  response: string;
  usage?: UsageEstimate;
  durationMs: number;
  timestamp: Date;
}
