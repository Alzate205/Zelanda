// Captura cada pantalla de la app en tamaño celular, para revisarlas de a
// muchas sin tener que abrir la app pantalla por pantalla.
//
// El barrido de al lado mide cosas que se pueden medir: desborde, scroll,
// errores de consola. Esto es para lo otro: texto cortado, números que no
// entran, botones pegados al borde, tarjetas vacías que no dicen nada. Nada de
// eso salta en una medición y en el campo es lo primero que se ve.
//
//   node scripts/capturas-pantallas.mjs           → todas
//   node scripts/capturas-pantallas.mjs jefe      → solo un rol
//
// Las imágenes quedan en capturas/<rol>/<pantalla>.png (carpeta ignorada).

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  E2E_JEFE,
  E2E_TRABAJADOR,
  E2E_BODEGA,
  E2E_ALMACEN,
} from '../tests/e2e/credenciales.mjs';
import {
  PANTALLAS_JEFE,
  PANTALLAS_TRABAJADOR,
  PANTALLAS_BODEGA,
  PANTALLAS_ALMACEN,
} from './pantallas.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SALIDA = 'capturas';
const soloRol = process.argv[2];

const ROLES = [
  ['jefe', E2E_JEFE, PANTALLAS_JEFE],
  ['trabajador', E2E_TRABAJADOR, PANTALLAS_TRABAJADOR],
  ['bodega', E2E_BODEGA, PANTALLAS_BODEGA],
  ['almacen', E2E_ALMACEN, PANTALLAS_ALMACEN],
].filter(([nombre]) => !soloRol || nombre === soloRol);

const navegador = await chromium.launch();

for (const [rol, cred, pantallas] of ROLES) {
  const dir = path.join(SALIDA, rol);
  await fs.mkdir(dir, { recursive: true });

  const ctx = await navegador.newContext({
    // Mismo tamaño que un celular de gama media, que es lo que hay en la finca.
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  p.setDefaultNavigationTimeout(90000);

  // El indicador de desarrollo de Next.js se planta en la esquina de abajo a la
  // izquierda y tapa el primer ítem de la barra de navegación. No existe en
  // producción, así que en las capturas sólo estorba: haría revisar un problema
  // que nadie va a ver nunca.
  await p.addInitScript(() => {
    const css = document.createElement('style');
    css.textContent =
      'nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none !important}';
    document.addEventListener('DOMContentLoaded', () => document.head.append(css));
  });

  await p.goto(`${BASE}/login`);
  await p.fill('input[name="identificador"]', cred.email);
  await p.fill('input[name="password"]', cred.password);
  await p.click('button:has-text("Entrar")');
  await p.waitForURL(/\/(jefe|trabajador|bodega|almacen)/, {
    waitUntil: 'commit',
    timeout: 180000,
  });

  for (const [ruta, nombre] of pantallas) {
    const archivo = path.join(dir, `${nombre.replace(/[^a-z0-9]+/gi, '-')}.png`);
    try {
      await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
      // El mapa y los datos tardan; sin esta espera se capturan esqueletos.
      await p.waitForTimeout(2500);
      await p.screenshot({ path: archivo });
      console.log(`✓ ${nombre}`);
    } catch (e) {
      console.log(`✗ ${nombre} — ${String(e).slice(0, 80)}`);
    }
  }
  await ctx.close();
}

await navegador.close();
console.log(`\nCapturas en ${SALIDA}/`);
