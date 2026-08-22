import { test, expect, type Page } from '@playwright/test';
import { E2E_BODEGA } from './credenciales.mjs';

/**
 * Bodega y almacén eran los dos únicos roles sin datos sin señal: las rutas de
 * snapshot, sus tipos, sus tablas de IndexedDB y su caché en el service worker
 * existían, y nadie las llamaba. Esto comprueba que ya no.
 */

async function entrar(page: Page) {
  await page.goto('/login');
  await page.locator('#identificador').fill(E2E_BODEGA.email);
  await page.locator('#password').fill(E2E_BODEGA.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/bodega$/, { timeout: 90_000 });
}

test.describe.serial('Bodega sin señal', () => {
  test('el inventario queda guardado en el celular y se puede ver sin conexión', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await entrar(page);
    // Que el service worker tome el control y corran la sincronización y la
    // precarga, que es justo lo que antes no pasaba.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(9000);

    const guardado = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('zelanda-offline-v1');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (!db.objectStoreNames.contains('cache_bodega')) return null;
      const fila = await new Promise<{ data?: Record<string, unknown> } | undefined>((res, rej) => {
        const r = db.transaction('cache_bodega').objectStore('cache_bodega').get('snapshot');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const d = fila?.data;
      if (!d) return null;
      return {
        herramientas: Array.isArray(d.herramientas) ? d.herramientas.length : -1,
        insumos: Array.isArray(d.insumos) ? d.insumos.length : -1,
        personas: Array.isArray(d.personas) ? d.personas.length : -1,
      };
    });

    // Lo que antes no existía: el snapshot de bodega guardado en el celular.
    expect(guardado, 'el snapshot de bodega no quedó en IndexedDB').not.toBeNull();
    expect(guardado!.insumos).toBeGreaterThan(0);
    expect(guardado!.herramientas).toBeGreaterThanOrEqual(0);

    // Y sin señal se puede seguir navegando por las pantallas precargadas.
    await ctx.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false, null, { timeout: 20_000 });

    await page.goto('/bodega/inventario', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const texto = await page.evaluate(() => document.body.innerText);
    expect(texto, 'el inventario no cargó sin señal').not.toMatch(/chrome-error|ERR_INTERNET/i);
    expect(texto.length).toBeGreaterThan(50);

    await ctx.close();
  });
});
