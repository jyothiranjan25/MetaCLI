import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  tsconfig: 'tsconfig.build.json',
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: false,
  sourcemap: true,
  external: [
    'react',
    'ink',
    'ink-spinner',
    'commander',
    '@metacli/core',
    '@metacli/adapters',
    '@metacli/telemetry',
    '@metacli/brain',
    '@metacli/workflow'
  ]
});
