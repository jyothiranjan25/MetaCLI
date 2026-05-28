import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],          // Must be ESM — ink uses top-level await
  clean: true,
  dts: false,
  splitting: true,
  shims: true,
  platform: 'node',
  tsconfig: 'tsconfig.build.json',
  banner: {
    // Polyfill require() for CJS interop in ESM bundles
    js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`,
  },
  minify: false,
  sourcemap: true,
  // Bundle all @metacli/* workspace packages for global install
  noExternal: [
    '@metacli/core',
    '@metacli/adapters',
    '@metacli/telemetry',
    '@metacli/brain',
    '@metacli/workflow',
    '@metacli/plugins',
    'chalk',  // bundle chalk — v4 is CJS, v5 is ESM; polyfill handles it
  ],
  // These stay external — resolved from user's node_modules at runtime
  external: [
    'react',
    'ink',
    'ink-spinner',
    'commander',
    'better-sqlite3',  // Native addon — must stay external
  ],
});

