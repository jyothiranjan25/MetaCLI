import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  splitting: true,
  shims: true,
  platform: 'node',
  tsconfig: 'tsconfig.build.json',
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
  // We bundle internal @metacli/* packages for the global install
  noExternal: [
    '@metacli/core',
    '@metacli/adapters',
    '@metacli/telemetry',
    '@metacli/brain',
    '@metacli/workflow',
    '@metacli/plugins'
  ],
  external: [
    'react',
    'ink',
    'ink-spinner',
    'commander',
    'chalk'
  ]
});
