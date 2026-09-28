import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  maxFailures: process.env.CI ? 1 : undefined,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
