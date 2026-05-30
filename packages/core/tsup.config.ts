import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: false,
  tsconfig: 'tsconfig.build.json',
  external: ['@metacli/brain'],
});
