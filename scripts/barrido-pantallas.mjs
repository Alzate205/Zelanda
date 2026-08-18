// Barrido de pantallas en tamaño celular. Revisa de una sola pasada las cosas
// que se han estado escapando: barra que se desliza, documento que scrollea,
// desborde horizontal, franja entre header y contenido, y errores de consola.
import { chromium } from 'playwright';
import { E2E_JEFE, E2E_TRABAJADOR } from '../tests/e2e/credenciales.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const fallos = [];

const PANTALLAS_JEFE = [
  ['/jefe', 'inicio (mapa)'],
  ['/jefe/asignaciones', 'tareas'],
  ['/jefe/lotes', 'lotes'],
  ['/jefe/equipo', 'equipo'],
  ['/jefe/alertas', 'alertas'],
  ['/jefe/pagos', 'pagos'],
  ['/jefe/pagos/nuevo', 'nuevo pago'],
  ['/jefe/jornales', 'jornales'],
  ['/jefe/novedades', 'novedades'],
  ['/jefe/saldos', 'saldos'],
  ['/jefe/compras', 'compras'],
  ['/jefe/ventas', 'ventas'],
  ['/jefe/reportes', 'reportes'],
  ['/jefe/configuracion', 'configuración'],
  ['/jefe/asignaciones/nueva', 'nueva tarea'],
  ['/mi-perfil', 'mi perfil'],
];

const PANTALLAS_TRABAJADOR = [
  ['/trabajador', 'trabajador inicio'],
  ['/trabajador/pendientes', 'pendientes'],
  ['/trabajador/novedad/nueva', 'nueva novedad'],
];

const navegador = await chromium.launch();

async function revisar(cred, pantallas) {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 664 },
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
  await p.waitForURL(/\/(jefe|trabajador)/, { waitUntil: 'commit', timeout: 180000 });

  for (const [ruta, nombre] of pantallas) {
    errores.length = 0;
    try {
      await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2200);
    } catch (e) {
      fallos.push(`${nombre}: no cargó — ${String(e).slice(0, 60)}`);
      continue;
    }

    const m = await p.evaluate(() => {
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
      };
    });

    // Deslizar documento y contenido, como un dedo.
    await p.evaluate(() => window.scrollBy(0, 500));
    await p.evaluate(() => document.querySelector('main')?.scrollBy(0, 500));
    await p.waitForTimeout(500);

    const d = await p.evaluate(() => ({
      navTop: document.querySelector('nav')
        ? Math.round(document.querySelector('nav').getBoundingClientRect().top)
        : null,
      docScroll: Math.round(window.scrollY),
    }));

    const problemas = [];
    if (m.hayNav && m.navTop !== d.navTop) {
      problemas.push(`la barra se movió ${m.navTop}→${d.navTop}`);
    }
    if (d.docScroll !== 0) problemas.push(`el documento scrolleó ${d.docScroll}px`);
    if (m.docAlto > m.vista + 1) problemas.push(`documento más alto que la pantalla (${m.docAlto}>${m.vista})`);
    if (m.anchoDoc > m.anchoVista + 1) problemas.push(`desborde horizontal (${m.anchoDoc}>${m.anchoVista})`);
    if (m.hueco !== null && m.hueco > 2) problemas.push(`hueco de ${m.hueco}px bajo el header`);
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

await revisar(E2E_JEFE, PANTALLAS_JEFE);
await revisar(E2E_TRABAJADOR, PANTALLAS_TRABAJADOR);
await navegador.close();

console.log('');
console.log(fallos.length === 0 ? 'BARRIDO: TODO LIMPIO' : `BARRIDO: ${fallos.length} pantallas con problemas`);
process.exit(fallos.length === 0 ? 0 : 1);
