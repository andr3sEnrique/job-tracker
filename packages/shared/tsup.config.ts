import { defineConfig } from 'tsup';

// Dual ESM/CJS output. Declarations come from `tsc -p tsconfig.build.json`
// (tsup's dts plugin relies on `baseUrl`, deprecated in TypeScript 6).
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  sourcemap: true,
  // In watch mode, cleaning would delete the tsc-generated .d.ts files on every rebuild
  // and briefly break type-checking in the apps that depend on this package.
  clean: !options.watch,
}));
