import { defineConfig } from 'tsup';

// Dual ESM/CJS output: Next.js consumes ESM, NestJS (CommonJS) consumes CJS.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // declarations come from `tsc` (tsup's dts plugin uses the TS 6-deprecated baseUrl)
  sourcemap: true,
  clean: true,
});
