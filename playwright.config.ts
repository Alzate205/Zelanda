import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 30 * 1000,
  // Margen amplio: los flujos críticos esperan redirecciones de server actions
  // que en frío compilan y hacen round-trips reales a Supabase.
  expect: { timeout: 20000 },
  // En serie a propósito: todos los tests comparten un único `next dev`, que
  // compila las rutas al vuelo. En paralelo se estorban entre ellos y los
  // `goto` se abortan o se pasan del timeout.
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
