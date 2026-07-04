import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const isRemote = Boolean(process.env.E2E_BASE_URL);
// Vercel "Protection Bypass for Automation" — only set if previews are protected.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // ordered flows share one e2e account
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
    ...(bypass
      ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypass } }
      : {}),
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /\d\d-.*\.spec\.ts/,
    },
    // legacy unauthenticated local smoke
    { name: 'public', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
