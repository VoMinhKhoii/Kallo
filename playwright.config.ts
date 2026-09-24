import { defineConfig, devices } from '@playwright/test';

// End-to-end specs: real browser, real Next dev server, third-party calls
// (Paddle) stubbed per test with `page.route`. Vitest owns `*.test.ts`; these
// are `*.spec.ts` under `e2e/` so neither runner collects the other's files.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun run dev --port ${PORT}`,
    url: `${baseURL}/en/pricing`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // A sandbox-shaped token switches /pricing onto live Paddle prices; the
    // specs stub Paddle.js itself (e2e/pricing/fake-paddle.ts).
    env: { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'test_e2e' },
  },
});
