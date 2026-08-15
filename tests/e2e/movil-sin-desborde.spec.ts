import { test, expect, type Page } from '@playwright/test';
import { E2E_JEFE, E2E_LOTE } from './credenciales.mjs';

/**
 * La app es mobile-first pero el resto de la suite corre a 1280x720. Este
 * archivo vigila lo único que el escritorio nunca ve: que nada se salga de
 * pantalla en el celular más angosto que se usa en campo (320 px).
 *
 * Solo lee: no crea ni modifica datos de la finca.
 */
const ANCHO_MINIMO = 320;

const PANTALLAS = [
  '/jefe/pagos/nuevo',
  '/jefe/jornales/nuevo',
  '/jefe/ausencias/nueva',
  '/recordatorios/nuevo',
  '/jefe/equipo/nuevo',
  '/jefe/lotes/nuevo',
  '/jefe/asignaciones/nueva',
];

async function elementosFueraDePantalla(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window.innerWidth;
    const fuera: string[] = [];
    document.querySelectorAll('*').forEach((n) => {
      const b = n.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && (b.right > w + 1 || b.left < -1)) {
        const clase = String((n as HTMLElement).className ?? '').slice(0, 60);
        fuera.push(
          `${n.tagName}${clase ? '.' + clase : ''} [${Math.round(b.left)}→${Math.round(b.right)}]`
        );
      }
    });
    return fuera;
  });
}

async function irA(page: Page, ruta: string) {
  // El centro de control dispara su propia navegación al montar.
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      return;
    } catch {
      await page.waitForTimeout(2000);
    }
  }
}

test.describe('Celular angosto', () => {
  test.use({ viewport: { width: ANCHO_MINIMO, height: 700 }, isMobile: true, hasTouch: true });

  test(`ninguna pantalla del jefe desborda a ${ANCHO_MINIMO}px`, async ({ page }) => {
    test.setTimeout(420_000);

    await page.goto('/login');
    await page.locator('#identificador').fill(E2E_JEFE.email);
    await page.locator('#password').fill(E2E_JEFE.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/jefe$/, { timeout: 120_000 });
    await page.waitForLoadState('load');

    for (const ruta of PANTALLAS) {
      await irA(page, ruta);
      await page.waitForLoadState('domcontentloaded');
      const fuera = await elementosFueraDePantalla(page);
      expect(fuera, `${ruta} tiene elementos fuera de pantalla`).toEqual([]);
    }

    // El paso 2 del wizard, con el campo "Fecha objetivo", que es donde se
    // reportó el problema. Solo se navega: no se crea la asignación.
    await irA(page, '/jefe/asignaciones/nueva');
    await page.getByPlaceholder(/Buscar lote/).fill(E2E_LOTE);
    await page
      .getByRole('button', { name: new RegExp(E2E_LOTE) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Fecha objetivo')).toBeVisible({ timeout: 60_000 });

    const fueraWizard = await elementosFueraDePantalla(page);
    expect(fueraWizard, 'el paso "Fecha objetivo" tiene elementos fuera de pantalla').toEqual([]);

    // El campo de fecha sigue siendo usable: se ve y acepta un valor.
    const fecha = page.locator('input[type=date]').first();
    await expect(fecha).toBeVisible();
    await fecha.fill('2026-09-01');
    await expect(fecha).toHaveValue('2026-09-01');
  });
});
