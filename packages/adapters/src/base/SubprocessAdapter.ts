/**
 * MetaCLI Adapters — Subprocess Adapter Base Class
 *
 * Provides the common subprocess lifecycle for all CLI adapters:
 * - Binary detection via `which`
 * - Process spawning via `execa`
 * - stdout streaming and parsing
 * - Graceful abort (SIGTERM → SIGKILL)
 * - ANSI stripping for clean output
 *
 * Subclasses implement the provider-specific details:
 * - CLI arguments for non-interactive mode
 * - Output parsing (JSON vs text)
 * - Auth checking
 * - Rate limit detection
 */

import { execa, type ResultPromise } from 'execa';
import which from 'which';
import type {
  AIAdapter,
  DetectionResult,
  AuthStatus,
  HealthStatus,
  AdapterCapabilities,
  PromptRequest,
  StreamEvent,
  UsageEstimate,
  RateLimitStatus,
} from '@metacli/core';

// ANSI escape code regex for stripping terminal formatting
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

export abstract class SubprocessAdapter implements AIAdapter {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: AdapterCapabilities;

  /** The CLI binary name to search for (e.g., 'claude', 'gemini') */
  protected abstract readonly binaryName: string;

  /** Optional alternative binary names to try */
  protected readonly alternativeBinaryNames: string[] = [];

  /** Track the running process for abort */
  protected currentProcess: ResultPromise | null = null;

  private cachedBinaryPath: string | null = null;
  private lastHealthCheck: HealthStatus | null = null;
  private lastHealthCheckAt = 0;
  private cachedDetection: DetectionResult | null = null;
  private static readonly HEALTH_TTL_MS = 30_000; // reuse within 30 s

  // ─── Lifecycle ──────────────────────────────────────────────

  async detect(): Promise<DetectionResult> {
    // Return cached result if binary was already located this session
    if (this.cachedDetection) return this.cachedDetection;

    // Try primary binary name
    const path = await this.findBinary(this.binaryName);
    if (path) {
      this.cachedBinaryPath = path;
      const version = await this.getVersion(path);
      this.cachedDetection = {
        installed: true,
        binaryPath: path,
        version: version ?? undefined,
        configDir: this.getConfigDir(),
      };
      return this.cachedDetection;
    }

    // Try alternatives
    for (const alt of this.alternativeBinaryNames) {
      const altPath = await this.findBinary(alt);
      if (altPath) {
        this.cachedBinaryPath = altPath;
        const version = await this.getVersion(altPath);
        this.cachedDetection = {
          installed: true,
          binaryPath: altPath,
          version: version ?? undefined,
          configDir: this.getConfigDir(),
        };
        return this.cachedDetection;
      }
    }

    this.cachedDetection = { installed: false };
    return this.cachedDetection;
  }

  abstract checkAuth(): Promise<AuthStatus>;

  async checkHealth(): Promise<HealthStatus> {
    // Return cached result within TTL — avoids repeated subprocess spawns
    const age = Date.now() - this.lastHealthCheckAt;
    if (this.lastHealthCheck && age < SubprocessAdapter.HEALTH_TTL_MS) {
      return this.lastHealthCheck;
    }

    const detection = await this.detect();

    if (!detection.installed) {
      const result: HealthStatus = { healthy: false, rateLimited: false, score: 0, lastChecked: new Date() };
      this.lastHealthCheck = result;
      this.lastHealthCheckAt = Date.now();
      return result;
    }

    const auth = await this.checkAuth();
    const rateLimit = await this.getRateLimitStatus();
    const healthy = auth.authenticated && !rateLimit.limited;

    this.lastHealthCheck = {
      healthy,
      rateLimited: rateLimit.limited,
      score: healthy ? 100 : 0,
      lastChecked: new Date(),
    };
    this.lastHealthCheckAt = Date.now();

    return this.lastHealthCheck;
  }

  // ─── Execution ──────────────────────────────────────────────

  abstract sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent, void, undefined>;

  async abort(): Promise<void> {
    if (!this.currentProcess) return;

    try {
      // Graceful shutdown
      this.currentProcess.kill('SIGTERM');

      // Give it 3 seconds, then force kill
      await Promise.race([
        this.currentProcess,
        new Promise<void>((resolve) =>
          setTimeout(() => {
            try {
              this.currentProcess?.kill('SIGKILL');
            } catch {
              // Process already exited
            }
            resolve();
          }, 3000),
        ),
      ]);
    } catch {
      // Process already exited
    } finally {
      this.currentProcess = null;
    }
  }

  // ─── Introspection ─────────────────────────────────────────

  abstract getUsageEstimate(): Promise<UsageEstimate>;
  abstract getRateLimitStatus(): Promise<RateLimitStatus>;

  // ─── Protected Helpers ─────────────────────────────────────

  /**
   * Get the binary path (cached after first detection).
   */
  protected getBinaryPath(): string {
    if (!this.cachedBinaryPath) {
      throw new Error(
        `${this.displayName} binary not found. Run detect() first or ensure ${this.binaryName} is installed.`,
      );
    }
    return this.cachedBinaryPath;
  }

  /**
   * Spawn a subprocess with the given arguments.
   * Returns the execa process handle.
   */
  protected spawn(args: string[], options: SpawnOptions = {}): ResultPromise {
    const binaryPath = this.getBinaryPath();

    const proc = execa(binaryPath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        // Disable ANSI colors for clean parsing when in JSON mode
        ...(options.disableColors
          ? { NO_COLOR: '1', TERM: 'dumb', FORCE_COLOR: '0' }
          : {}),
        ...options.env,
      },
      timeout: options.timeout,
      // Don't buffer — we stream
      buffer: false,
      // Inherit stderr for debugging
      stderr: options.inheritStderr ? 'inherit' : 'pipe',
    });

    this.currentProcess = proc;
    return proc;
  }

  /**
   * Strip ANSI escape codes from text.
   */
  protected stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
  }

  /**
   * Get the CLI version by running --version or equivalent.
   */
  protected async getVersion(binaryPath: string): Promise<string | null> {
    try {
      const { stdout } = await execa(binaryPath, ['--version'], {
        timeout: 5000,
        reject: false,
      });
      // Extract version number from output (e.g., "claude 1.2.3" → "1.2.3")
      const match = stdout.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
      return match ? match[1] : stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the provider's config directory path.
   * Override in subclasses for provider-specific paths.
   */
  protected getConfigDir(): string | undefined {
    return undefined;
  }

  // ─── Private Helpers ───────────────────────────────────────

  private async findBinary(name: string): Promise<string | null> {
    try {
      return await which(name);
    } catch {
      return null;
    }
  }
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  disableColors?: boolean;
  inheritStderr?: boolean;
}
