import { test, expect, type Page } from '@playwright/test';
import { E2E_TRABAJADOR, E2E_LOTE } from './credenciales.mjs';

// Un JPEG mínimo de verdad: el componente lo lee con createImageBitmap.
const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
    'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
    'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
    'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
    'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
    'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
    'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
    'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii' +
    'gD//2Q==',
  'base64'
);

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#identificador').fill(E2E_TRABAJADOR.email);
  await page.locator('#password').fill(E2E_TRABAJADOR.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/trabajador$/, { timeout: 60_000 });
}

test.describe.serial('La foto se puede tomar sin señal', () => {
  test('sin conexión el campo de foto sigue estando y la foto queda guardada', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await login(page);
    await page.goto('/trabajador/novedad/nueva', { waitUntil: 'domcontentloaded' });

    // Esperar a que hidrate antes de cortar la señal. El aviso de "sin señal"
    // lo pinta el cliente: en una máquina lenta el test alcanzaba a mirar el
    // HTML del servidor, que todavía dice "la foto se sube ahora", y fallaba
    // por una carrera suya y no por un fallo de la app.
    await page.waitForLoadState('networkidle');

    // Se corta la señal ANTES de tocar el formulario: es el caso del lote.
    await ctx.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false, null, { timeout: 20_000 });

    // Lo que fallaba antes: el campo de foto desaparecía sin conexión.
    const zonaFoto = page.getByText(/Tomar foto o elegir archivo/i);
    await expect(zonaFoto).toBeVisible();
    await expect(page.getByText(/sube sola cuando vuelva la conexión/i)).toBeVisible();

    // El lote de test, no el primero de la lista: reportar sobre un árbol de
    // un lote real dejaría una novedad de prueba en los datos de la finca.
    const lote = page.locator('#lote_id');
    const valorLoteTest = await lote
      .locator('option', { hasText: E2E_LOTE })
      .first()
      .getAttribute('value');
    expect(valorLoteTest).toBeTruthy();
    await lote.selectOption(valorLoteTest as string);
    await page.locator('#numero_placa').fill('1');
    await page.locator('#tipo').selectOption('PLAGA');
    await page.locator('#descripcion').fill('Prueba de foto sin señal');
    await page.locator('input[name="foto"]').setInputFiles({
      name: 'arbol.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_1PX,
    });
    await expect(page.getByAltText('Vista previa')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Reportar' }).click();
    // Sin señal no se navega: /trabajador lo arma el servidor y no cargaría.
    await expect(page.getByText(/Guardado en el celular/i)).toBeVisible({ timeout: 60_000 });

    // El blob tiene que estar realmente guardado en IndexedDB, no solo en memoria.
    const guardada = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('zelanda-offline-v1');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const items = await new Promise<Array<Record<string, unknown>>>((res, rej) => {
        const r = db.transaction('cola_novedades').objectStore('cola_novedades').getAll();
        r.onsuccess = () => res(r.result as Array<Record<string, unknown>>);
        r.onerror = () => rej(r.error);
      });
      const con = items.find((i) => i.foto_blob instanceof Blob);
      return con ? { hay: true, bytes: (con.foto_blob as Blob).size } : { hay: false, bytes: 0 };
    });
    expect(guardada.hay).toBe(true);
    expect(guardada.bytes).toBeGreaterThan(0);

    // Vuelve la señal. En Pendientes el trabajador tiene que poder VER que su
    // foto sigue ahí antes de que se suba.
    await ctx.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true, null, { timeout: 20_000 });
    await page.goto('/trabajador/pendientes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Foto guardada en el celular|Foto subida/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const db = await new Promise<IDBDatabase>((res, rej) => {
              const r = indexedDB.open('zelanda-offline-v1');
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            const items = await new Promise<Array<Record<string, unknown>>>((res, rej) => {
              const r = db.transaction('cola_novedades').objectStore('cola_novedades').getAll();
              r.onsuccess = () => res(r.result as Array<Record<string, unknown>>);
              r.onerror = () => rej(r.error);
            });
            // Se subió cuando el item se fue de la cola, o quedó con path y sin blob.
            if (items.length === 0) return 'subida';
            const i = items[0];
            if (i.estado === 'subido') return 'subida';
            if (typeof i.foto_path === 'string' && i.foto_path.startsWith('novedades/'))
              return 'foto-resuelta';
            return String(i.estado ?? 'desconocido');
          }),
        { timeout: 90_000, intervals: [2000] }
      )
      .toMatch(/subida|foto-resuelta/);

    await ctx.close();
  });
});
