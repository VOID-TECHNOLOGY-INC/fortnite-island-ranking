import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 20_000
  },
  webServer: [
    {
      command: 'npm --prefix functions run dev:mock',
      url: 'http://127.0.0.1:5001/health',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'npm --prefix web run preview:e2e',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    trace: 'on-first-retry'
  }
});
