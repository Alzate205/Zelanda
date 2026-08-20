// Barrido de pantallas en tamaño celular. Revisa de una sola pasada las cosas
// que se han estado escapando: barra que se desliza, documento que scrollea,
// desborde horizontal, franja entre header y contenido, y errores de consola.
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
// 390 es un celular común; 320 es el más angosto que se usa en campo y es donde
// aparece el desborde horizontal. Antes solo se miraban 7 pantallas a 320 y el
// resto nunca se probó tan angosto.
//   ANCHO=320 node scripts/barrido-pantallas.mjs
const ANCHO = Number(process.env.ANCHO ?? 390);
// Arriba de esto, en un celular con señal de finca, la pantalla se siente rota:
// la persona toca, no pasa nada, y vuelve a tocar. Se mide en desarrollo, que
// es más lento que producción, así que sirve para comparar pantallas entre sí
// más que como número absoluto.
const LENTO_MS = 3000;
const tiempos = [];
const fallos = [];

const navegador = await chromium.launch();

async function revisar(cred, pantallas) {
  const ctx = await navegador.newContext({
    viewport: { width: ANCHO, height: 664 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  p.setDefaultNavigationTimeout(90000);

  const errores = [];
  p.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text().slice(0, 120));
  });

  await p.goto(`${BASE}/login`);
  await p.fill('input[name="identificador"]', cred.email);
  await p.fill('input[name="password"]', cred.password);
  await p.click('button:has-text("Entrar")');
  // 'commit' y no 'load': la home del jefe trae el mapa y esperar su carga
  // completa se pasa de cualquier tope razonable, sobre todo en desarrollo.
  await p.waitForURL(/\/(jefe|trabajador|bodega|almacen)/, {
    waitUntil: 'commit',
    timeout: 180000,
  });

  for (const [ruta, nombre] of pantallas) {
    errores.length = 0;
    const t0 = Date.now();
    try {
      await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2200);
    } catch (e) {
      // Se imprime, no solo se acumula: una pantalla que ni carga es la falla
      // más grave que puede haber, y era la única que no aparecía en la salida.
      const detalle = String(e).replace(/\s+/g, ' ').slice(0, 120);
      console.log(`FALLA · ${nombre}  →  no cargó: ${detalle}`);
      fallos.push(`${nombre}: no cargó — ${detalle}`);
      continue;
    }

    // Se mide con reintento y bajo try. Una página que todavía está hidratando
    // destruye el contexto en medio del evaluate ("Execution context was
    // destroyed"), y esa excepción, sin atrapar, tumbaba el proceso entero: las
    // pantallas que venían después no se probaban y nadie se enteraba, porque
    // el barrido terminaba sin decir que había quedado por la mitad.
    const medir = () =>
      p.evaluate(() => {
      const nav = document.querySelector('nav');
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      const r = (el) => (el ? el.getBoundingClientRect() : null);
      const h = r(header);
      return {
        navTop: nav ? Math.round(r(nav).top) : null,
        hayNav: !!nav,
        docAlto: Math.round(document.documentElement.scrollHeight),
        vista: window.innerHeight,
        anchoDoc: Math.round(document.documentElement.scrollWidth),
        anchoVista: window.innerWidth,
        // Hueco entre el borde de abajo del header y el inicio del contenido.
        hueco: h && main ? Math.round(r(main).top - h.bottom) : null,
        titulo: (document.querySelector('h1')?.textContent ?? '').slice(0, 40),
        // Lo que se escapó antes: el marco interno no scrolleaba, pero el
        // documento sí, y en iPhone el rebote arrastraba toda la pantalla.
        bodyScrolleable: document.body.scrollHeight > window.innerHeight + 1,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
      });

    let m;
    try {
      m = await medir();
    } catch {
      await p.waitForTimeout(2000);
      try {
        m = await medir();
      } catch (e) {
        const detalle = String(e).replace(/\s+/g, ' ').slice(0, 120);
        console.log(`FALLA · ${nombre}  →  no se pudo medir: ${detalle}`);
        fallos.push(`${nombre}: no se pudo medir — ${detalle}`);
        continue;
      }
    }

    // Deslizar documento y contenido, como un dedo.
    let d;
    try {
      await p.evaluate(() => window.scrollBy(0, 500));
      await p.evaluate(() => document.querySelector('main')?.scrollBy(0, 500));
      await p.waitForTimeout(500);
      d = await p.evaluate(() => ({
        navTop: document.querySelector('nav')
          ? Math.round(document.querySelector('nav').getBoundingClientRect().top)
          : null,
        docScroll: Math.round(window.scrollY),
      }));
    } catch (e) {
      const detalle = String(e).replace(/\s+/g, ' ').slice(0, 120);
      console.log(`FALLA · ${nombre}  →  no se pudo deslizar: ${detalle}`);
      fallos.push(`${nombre}: no se pudo deslizar — ${detalle}`);
      continue;
    }

    const ms = Date.now() - t0 - 2200;
    tiempos.push([nombre, ms]);

    const problemas = [];
    if (ms > LENTO_MS) problemas.push(`tardó ${(ms / 1000).toFixed(1)}s en abrir`);
    if (m.hayNav && m.navTop !== d.navTop) {
      problemas.push(`la barra se movió ${m.navTop}→${d.navTop}`);
    }
    if (d.docScroll !== 0) problemas.push(`el documento scrolleó ${d.docScroll}px`);
    if (m.docAlto > m.vista + 1) problemas.push(`documento más alto que la pantalla (${m.docAlto}>${m.vista})`);
    if (m.anchoDoc > m.anchoVista + 1) problemas.push(`desborde horizontal (${m.anchoDoc}>${m.anchoVista})`);
    if (m.hueco !== null && m.hueco > 2) problemas.push(`hueco de ${m.hueco}px bajo el header`);
    if (m.bodyScrolleable) problemas.push('el body puede scrollear');
    if (!m.bodyOverflow.includes('hidden')) {
      problemas.push(`el body no está anclado (overflow: ${m.bodyOverflow})`);
    }
    if (errores.length) problemas.push(`consola: ${errores[0]}`);

    if (problemas.length) {
      console.log(`FALLA · ${nombre}  →  ${problemas.join(' · ')}`);
      fallos.push(`${nombre}: ${problemas.join('; ')}`);
    } else {
      console.log(`OK    · ${nombre}`);
    }
  }
  await ctx.close();
}

// Cada rol va aislado: si uno no puede ni entrar, los otros tres igual se
// revisan. Antes bastaba un tropiezo para que el barrido terminara sin haber
// mirado la mitad de la app, y sin decirlo.
for (const [cred, pantallas, rol] of [
  [E2E_JEFE, PANTALLAS_JEFE, 'jefe'],
  [E2E_TRABAJADOR, PANTALLAS_TRABAJADOR, 'trabajador'],
  [E2E_BODEGA, PANTALLAS_BODEGA, 'bodega'],
  [E2E_ALMACEN, PANTALLAS_ALMACEN, 'almacén'],
]) {
  try {
    await revisar(cred, pantallas);
  } catch (e) {
    const detalle = String(e).replace(/\s+/g, ' ').slice(0, 140);
    console.log(`FALLA · rol ${rol} no se pudo revisar  →  ${detalle}`);
    fallos.push(`rol ${rol}: no se pudo revisar — ${detalle}`);
  }
}
await navegador.close();

console.log('');
const lentas = tiempos.filter(([, ms]) => ms > LENTO_MS).sort((a, b) => b[1] - a[1]);
if (lentas.length) {
  console.log('Pantallas más lentas:');
  for (const [nombre, ms] of lentas.slice(0, 10)) {
    console.log(`  ${(ms / 1000).toFixed(1)}s  ${nombre}`);
  }
  console.log('');
}
console.log(`Ancho probado: ${ANCHO}px`);
console.log(fallos.length === 0 ? 'BARRIDO: TODO LIMPIO' : `BARRIDO: ${fallos.length} pantallas con problemas`);
process.exit(fallos.length === 0 ? 0 : 1);
