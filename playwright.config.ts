import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '4173');
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `pnpm build && HOST=localhost PORT=${port} ORIGIN=${origin} pnpm start`,
    url: `${origin}/health`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /tests\/visual\/workspace\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testIgnore: /tests\/visual\/workspace\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      testIgnore: /tests\/visual\/workspace\.spec\.ts/,
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'workspace',
      testMatch: /tests\/visual\/workspace\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
