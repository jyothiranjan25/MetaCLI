/**
 * MetaCLI Core — Configuration Schema & Loader
 *
 * Uses cosmiconfig for standard config file discovery and zod for
 * runtime validation. Supports ~/.metacli/config.yaml, .metaclirc,
 * and metacli.config.ts patterns.
 */

import { z } from 'zod';

// ─── Configuration Schema ──────────────────────────────────────

export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  priority: z.number().min(0).max(100).default(50),
  binaryPath: z.string().optional(),
  extraArgs: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  timeout: z.number().min(1000).default(300_000), // 5 min default
  maxRetries: z.number().min(0).default(1),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const RoutingConfigSchema = z.object({
  preferredProvider: z.string().optional(),
  fallbackOrder: z.array(z.string()).default([]),
  healthCheckInterval: z.number().min(5000).default(60_000), // 1 min
  cooldownDuration: z.number().min(10_000).default(300_000), // 5 min
  healthScoreThreshold: z.number().min(0).max(100).default(20),
});

export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

export const BrainConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dataDir: z.string().default('.metacli'),
  autoScan: z.boolean().default(true),
  ignorePaths: z.array(z.string()).default([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '__pycache__',
    '.turbo',
    '.metacli',
  ]),
  maxFileSize: z.number().default(1_000_000), // 1MB
  embeddingsEnabled: z.boolean().default(false), // Phase 3
});

export type BrainConfig = z.infer<typeof BrainConfigSchema>;

export const SecurityConfigSchema = z.object({
  mode: z.enum(['safe', 'trusted', 'autonomous']).default('safe'),
  allowedPaths: z.array(z.string()).default([]),
  blockedPaths: z.array(z.string()).default([
    '~/.ssh',
    '~/.aws',
    '~/.config',
    '~/.npm',
    '~/.pnpm-state',
    '~/.gitconfig',
    '~/Library',
    '~/Documents',
  ]),
  permissions: z.object({
    filesystem: z.array(z.string()).default(['read', 'write']),
    commands: z.object({
      allow: z.array(z.string()).default([
        'npm', 'pnpm', 'yarn', 'git', 'cargo', 'docker-compose', 'docker compose',
        'pytest', 'vitest', 'tsc', 'eslint', 'prettier', 'go'
      ]),
      deny: z.array(z.string()).default([
        'rm -rf /', 'shutdown', 'sudo rm', 'poweroff', 'reboot', 'mkfs', 'dd if=', 'crontab -r'
      ]),
    }).default({}),
  }).default({}),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

export const MetaCLIConfigSchema = z.object({
  providers: z.record(ProviderConfigSchema).default({}),
  routing: RoutingConfigSchema.default({}),
  brain: BrainConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  defaultWorkingDirectory: z.string().optional(),
  verbose: z.boolean().default(false),
  telemetry: z.boolean().default(true),
});

export type MetaCLIConfig = z.infer<typeof MetaCLIConfigSchema>;

