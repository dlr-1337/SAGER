import { defineConfig } from '@playwright/test';

const port = Number(process.env['SAGER_E2E_PORT'] ?? 4200);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `npm start -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/acesso`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
