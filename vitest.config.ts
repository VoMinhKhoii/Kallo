import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'server-only': resolve(
        __dirname,
        'lib/__test-utils__/server-only-shim.ts'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: [
      ...configDefaults.exclude,
      '**/.next/**',
      // Flutter app is Dart; its gitignored build/ dir vendors third-party
      // TS test files (RevenueCat pod checkouts) that are not ours to run.
      'apps/mobile-flutter/**',
      // Git worktrees live here and carry their own node_modules. Without
      // this, vitest globs their test files, resolves a SECOND copy of React
      // for them, and every render fails on `useContext` of null — 166
      // phantom failures, and a run slow enough to look hung.
      '.claude/worktrees/**',
    ],
  },
});
