import { test, expect, type Page } from '@playwright/test';
import { E2E_JEFE, E2E_TRABAJADOR, E2E_LOTE, E2E_TIPO_TAREA } from './credenciales.mjs';

/**
 * En dev, Next compila la ruta al vuelo y el centro de control dispara su
 * propia navegación al montar: un `goto` puede abortarse. Se reintenta.
 */
async function irA(page: Page, ruta: string) {
  let ultimo: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      return;
    } catch (e) {
      ultimo = e;
      await page.waitForTimeout(2000);
    }
  }
  throw ultimo;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#identificador').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe.serial('Flujos críticos', () => {
  test('login → asignar tarea → registrar avance', async ({ browser }) => {
    // El flujo encadena varios server actions/redirects en frío (login,
    // crear asignación, registrar avance), así que damos margen al test entero.
    test.setTimeout(300_000);

    // ── Paso 1: login jefe ───────────────────────────────────────────────
    const ctxJefe = await browser.newContext();
    const pageJefe = await ctxJefe.newPage();
    await login(pageJefe, E2E_JEFE.email, E2E_JEFE.password);
    await expect(pageJefe).toHaveURL(/\/jefe$/);

    // ── Paso 2: asignar tarea (wizard de 4 pasos) ────────────────────────
    await irA(pageJefe, '/jefe/asignaciones/nueva');

    // Paso 1 wizard: buscar el lote y seleccionarlo (el buscador oculta los
    // "sugeridos", así que sólo queda una fila que matchea el nombre).
    // El lote de test también sale en "sugeridos" (no tiene historial), así que
    // el nombre matchea dos botones: el sugerido y el del resultado de búsqueda.
    await pageJefe.getByPlaceholder(/Buscar lote/).fill(E2E_LOTE);
    await pageJefe
      .getByRole('button', { name: new RegExp(E2E_LOTE) })
      .first()
      .click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2 wizard: elegir el tipo de tarea de cultivo.
    await pageJefe.getByRole('button', { name: new RegExp(E2E_TIPO_TAREA) }).click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3 wizard: elegir al trabajador test (carga 0 → aparece en "Disponibles").
    await pageJefe.getByRole('button', { name: new RegExp(E2E_TRABAJADOR.nombre) }).click();
    await pageJefe.getByRole('button', { name: 'Continuar' }).click();

    // Paso 4 wizard: confirmar.
    await pageJefe.getByRole('button', { name: 'Crear asignación' }).click();
    await expect(pageJefe).toHaveURL(/\/jefe\/asignaciones$/);
    await expect(pageJefe.getByText(E2E_TRABAJADOR.nombre).first()).toBeVisible();

    // ── Paso 3: registrar avance (contexto/sesión nuevos) ────────────────
    const ctxTrab = await browser.newContext();
    const pageTrab = await ctxTrab.newPage();
    await login(pageTrab, E2E_TRABAJADOR.email, E2E_TRABAJADOR.password);
    await expect(pageTrab).toHaveURL(/\/trabajador$/);

    // La pantalla del trabajador es la lista de tarjetas: se toca la tarea.
    await pageTrab
      .getByRole('link', { name: new RegExp(E2E_TIPO_TAREA) })
      .first()
      .click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/avance\//);

    // Avance parcial: el "desde" lo calcula la app, sólo se escribe el "hasta".
    // Lote real con miles de árboles → la asignación queda EN_CURSO.
    await pageTrab.getByRole('button', { name: /Avancé hasta un árbol/ }).click();
    await pageTrab.locator('#hasta').fill('5');
    await pageTrab.getByRole('button', { name: /Registrar/ }).click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/exito\//);

    await ctxJefe.close();
    await ctxTrab.close();
  });
});
