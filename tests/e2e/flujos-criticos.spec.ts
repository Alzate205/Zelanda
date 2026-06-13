import { test, expect, type Page } from '@playwright/test';
import { E2E_JEFE, E2E_TRABAJADOR, E2E_LOTE, E2E_TIPO_TAREA } from './credenciales.mjs';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#identificador').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe.serial('Flujos críticos', () => {
  test('login → asignar tarea → registrar avance', async ({ browser }) => {
    // ── Paso 1: login jefe ───────────────────────────────────────────────
    const ctxJefe = await browser.newContext();
    const pageJefe = await ctxJefe.newPage();
    await login(pageJefe, E2E_JEFE.email, E2E_JEFE.password);
    await expect(pageJefe).toHaveURL(/\/jefe$/);

    // ── Paso 2: asignar tarea (wizard de 4 pasos) ────────────────────────
    await pageJefe.goto('/jefe/asignaciones/nueva');

    // Paso 1 wizard: buscar el lote y seleccionarlo (el buscador oculta los
    // "sugeridos", así que sólo queda una fila que matchea el nombre).
    await pageJefe.getByPlaceholder(/Buscar lote/).fill(E2E_LOTE);
    await pageJefe.getByRole('button', { name: new RegExp(E2E_LOTE) }).click();
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

    await pageTrab.goto('/trabajador/tareas');
    await pageTrab
      .getByRole('link', { name: new RegExp(E2E_TIPO_TAREA) })
      .first()
      .click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/avance\//);

    // Avance TRAMO 1–5 (lote real con miles de árboles → queda EN_CURSO).
    await pageTrab.locator('#desde').fill('1');
    await pageTrab.locator('#hasta').fill('5');
    await pageTrab.getByRole('button', { name: /Registrar/ }).click();
    await expect(pageTrab).toHaveURL(/\/trabajador\/exito\//);

    await ctxJefe.close();
    await ctxTrab.close();
  });
});
