import { defineConfig, devices } from '@playwright/test';

// El puerto se puede mover: si ya tenés un `next dev` abierto en el 3000, el
// arranque del servidor de pruebas falla y la suite no corre.
//   PORT=3001 npx playwright test
const PUERTO = process.env.PORT ?? '3000';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 30 * 1000,
  // Margen amplio: los flujos críticos esperan redirecciones de server actions
  // que en frío compilan y hacen round-trips reales a Supabase.
  expect: { timeout: 20000 },
  // En serie a propósito: todos los tests comparten un único servidor.
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    baseURL: BASE,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Cuando se apunta a un despliegue real (Vercel), no hay servidor local que
  // levantar: se prueba contra lo que de verdad usa la gente.
  webServer: BASE.includes('localhost')
    ? {
        // Contra un build de producción, NO contra `next dev`.
        //
        // `next dev` compila cada ruta la primera vez que alguien la visita, y ese
        // costo cae dentro del test que tenga la mala suerte de llegar primero.
        // Como el orden y la carga del runner cambian, fallaba un test distinto en
        // cada corrida: tres corridas del mismo commit rompieron en tres tests
        // distintos, y en cada una los otros pasaban. Los timeouts se habían ido
        // inflando hasta 600 s persiguiendo ese síntoma.
        //
        // Requiere `npm run build` antes. Para iterar rápido en local, sin build:
        // PLAYWRIGHT_DEV=1 npx playwright test
        command: process.env.PLAYWRIGHT_DEV ? 'npm run dev' : 'npm run start',
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
