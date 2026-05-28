/**
 * MetaCLI Core — AIAdapter Interface
 *
 * This is THE central abstraction. Every provider (Claude, Gemini, Aider, etc.)
 * implements this interface. The Orchestrator and Router only interact with
 * providers through this contract — never directly with subprocess details.
 */

import type {
  AdapterCapabilities,
  AuthStatus,
  DetectionResult,
  HealthStatus,
  PromptRequest,
  RateLimitStatus,
  StreamEvent,
  UsageEstimate,
} from '../events/types.js';

export interface AIAdapter {
  /** Unique identifier, e.g. "claude-code", "gemini-cli" */
  readonly id: string;

  /** Human-readable name, e.g. "Claude Code", "Gemini CLI" */
  readonly displayName: string;

  /** What this adapter can do */
  readonly capabilities: AdapterCapabilities;

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Detect if the CLI is installed and available on this system.
   * Should check PATH, known install locations, and version.
   */
  detect(): Promise<DetectionResult>;

  /**
   * Check if the user is authenticated with this provider.
   * Should NOT trigger any auth flow — just verify existing credentials.
   */
  checkAuth(): Promise<AuthStatus>;

  /**
   * Quick health check — is the provider responsive and not rate-limited?
   * Should be fast (ideally <1s) and non-destructive.
   */
  checkHealth(): Promise<HealthStatus>;

  // ─── Execution ──────────────────────────────────────────────

  /**
   * Send a prompt and stream the response back.
   * Returns an async generator of StreamEvents.
   *
   * The adapter is responsible for:
   * - Spawning the subprocess
   * - Passing the prompt via appropriate flags
   * - Parsing stdout into normalized StreamEvents
   * - Detecting rate limits and errors
   * - Cleaning up the subprocess on completion/abort
   */
  sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined>;

  /**
   * Abort the currently running prompt.
   * Should terminate the subprocess gracefully (SIGTERM, then SIGKILL).
   */
  abort(): Promise<void>;

  // ─── Introspection ─────────────────────────────────────────

  /**
   * Get estimated usage for the current session/window.
   * This is best-effort — many providers don't expose exact quotas.
   */
  getUsageEstimate(): Promise<UsageEstimate>;

  /**
   * Get current rate limit status.
   * Parsed from subprocess output or heuristically estimated.
   */
  getRateLimitStatus(): Promise<RateLimitStatus>;
}
