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
    globals: true,
    pool: 'forks',
    setupFiles: ['./vitest.setup.ts'],
    // Building a jsdom window was 58% of the CI test run, and most suites
    // never touch the DOM. Component suites (.tsx) get jsdom; .ts suites run
    // in Node, and the few that need a DOM opt in with a
    // `// @vitest-environment jsdom` comment on their first line.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
        },
      },
    ],
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
      ...(process.env.RUN_LIVE_OCR_TESTS ? [] : ['**/label-ocr-live.test.ts']),
    ],
  },
});
