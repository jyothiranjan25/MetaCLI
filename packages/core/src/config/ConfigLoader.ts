/**
 * MetaCLI Core — Configuration Loader
 *
 * Uses cosmiconfig to discover configuration from standard locations:
 * - ~/.metacli/config.yaml (global)
 * - .metaclirc / metacli.config.ts (project-level)
 * - Environment variables (METACLI_*)
 *
 * Project-level config overrides global config.
 */

import { cosmiconfig } from 'cosmiconfig';
import { MetaCLIConfigSchema, type MetaCLIConfig } from './schema.js';

const MODULE_NAME = 'metacli';

export class ConfigLoader {
  private config: MetaCLIConfig | null = null;
  private explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.yaml`,
      `.${MODULE_NAME}rc.yml`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.ts`,
      `${MODULE_NAME}.config.mjs`,
      `.${MODULE_NAME}/config.yaml`,
      `.${MODULE_NAME}/config.yml`,
      `.${MODULE_NAME}/config.json`,
    ],
  });

  /**
   * Load configuration by searching from the given directory upward.
   * Merges with global config from ~/.metacli/config.yaml.
   */
  async load(searchFrom?: string): Promise<MetaCLIConfig> {
    if (this.config) {
      return this.config;
    }

    let rawConfig: Record<string, unknown> = {};

    // 1. Try to find project-level config
    try {
      const result = await this.explorer.search(searchFrom);
      if (result && !result.isEmpty) {
        rawConfig = result.config as Record<string, unknown>;
      }
    } catch {
      // No config found — use defaults
    }

    // 2. Try global config (~/.metacli/config.yaml)
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const globalResult = await this.explorer.load(`${homeDir}/.metacli/config.yaml`);
      if (globalResult && !globalResult.isEmpty) {
        // Project config overrides global config
        rawConfig = deepMerge(globalResult.config as Record<string, unknown>, rawConfig);
      }
    } catch {
      // No global config — that's fine
    }

    // 3. Apply environment variable overrides
    rawConfig = applyEnvOverrides(rawConfig);

    // 4. Validate and parse with zod
    const parsed = MetaCLIConfigSchema.safeParse(rawConfig);
    if (!parsed.success) {
      throw new ConfigValidationError(parsed.error.format());
    }

    this.config = parsed.data;
    return this.config;
  }

  /**
   * Get the current config (must call load() first).
   */
  get(): MetaCLIConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Reset cached config (useful for testing).
   */
  reset(): void {
    this.config = null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];

    if (
      baseVal &&
      overVal &&
      typeof baseVal === 'object' &&
      typeof overVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }

  return result;
}

function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };

  // METACLI_PREFERRED_PROVIDER → routing.preferredProvider
  if (process.env.METACLI_PREFERRED_PROVIDER) {
    if (!result.routing || typeof result.routing !== 'object') {
      result.routing = {};
    }
    (result.routing as Record<string, unknown>).preferredProvider =
      process.env.METACLI_PREFERRED_PROVIDER;
  }

  // METACLI_VERBOSE → verbose
  if (process.env.METACLI_VERBOSE === '1' || process.env.METACLI_VERBOSE === 'true') {
    result.verbose = true;
  }

  return result;
}

export class ConfigValidationError extends Error {
  constructor(public readonly details: unknown) {
    super(`Invalid MetaCLI configuration: ${JSON.stringify(details, null, 2)}`);
    this.name = 'ConfigValidationError';
  }
}
