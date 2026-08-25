// Barrido de TODAS las pantallas de la app, no de una lista escrita a mano.
//
// La lista de `pantallas.mjs` cubría 68 de 107 páginas: 32 no se probaban
// nunca, y entre ellas estaban casi todos los formularios de edición y el
// detalle de cada cosa. El bug del atajo de apiarios fue exactamente eso: una
// pantalla que nadie visitaba.
//
// Las rutas salen del sistema de archivos y los ids de la base, así que una
// pantalla nueva entra sola al barrido y no hay lista que se quede vieja.
//
//   node --env-file=.env.local --env-file=.env scripts/barrido-completo.mjs
//   ANCHO=320 node --env-file=.env.local --env-file=.env scripts/barrido-completo.mjs
import { chromium } from 'playwright';
import { globSync } from 'glob';
import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { E2E_JEFE, E2E_TRABAJADOR, E2E_BODEGA, E2E_ALMACEN } from '../tests/e2e/credenciales.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const ANCHO = Number(process.env.ANCHO ?? 390);
// El Bash de Windows se come las barras invertidas literales, así que el
// separador se arma por código de carácter.
const BS = String.fromCharCode(92);
const norm = (p) => p.split(BS).join('/');

function rutasDelCodigo() {
  return globSync('app/**/page.tsx')
    .map(norm)
    .map((f) => {
      const partes = f
        .replace(/^app\//, '')
        // sin la barra opcional, `app/page.tsx` quedaba como la ruta
        // inexistente "/page.tsx" y el barrido la reportaba como 404
        .replace(/\/?page\.tsx$/, '')
        .split('/')
        .filter((p) => p && !/^\(.*\)$/.test(p));
      return '/' + partes.join('/');
    })
    .sort();
}

async function resolverValores() {
  const p = new PrismaClient();
  const q = async (fn) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  const arbol = await q(() =>
    p.arboles.findFirst({
      where: { deleted_at: null },
      select: { lote_id: true, numero_placa: true },
    })
  );
  const v = {
    lote: await q(
      async () =>
        (
          await p.lotes.findFirst({ where: { deleted_at: null }, select: { id: true } })
        )?.id
    ),
    apiario: await q(async () => (await p.apiarios.findFirst({ select: { id: true } }))?.id),
    asignacion: await q(async () => (await p.asignaciones.findFirst({ select: { id: true } }))?.id),
    cliente: await q(async () => (await p.clientes.findFirst({ select: { id: true } }))?.id),
    compra: await q(async () => (await p.compras.findFirst({ select: { id: true } }))?.id),
    persona: await q(async () => (await p.personas.findFirst({ select: { id: true } }))?.id),
    instalacion: await q(
      async () => (await p.instalaciones.findFirst({ select: { id: true } }))?.id
    ),
    novedad: await q(async () => (await p.novedades.findFirst({ select: { id: true } }))?.id),
    proveedor: await q(async () => (await p.proveedores.findFirst({ select: { id: true } }))?.id),
    servicio: await q(
      async () => (await p.servicios_contratados.findFirst({ select: { id: true } }))?.id
    ),
    tipo_tarea: await q(async () => (await p.tipos_tarea.findFirst({ select: { id: true } }))?.id),
    insumo: await q(async () => (await p.insumos.findFirst({ select: { id: true } }))?.id),
    herramienta: await q(
      async () => (await p.herramientas.findFirst({ select: { id: true } }))?.id
    ),
    despacho: await q(async () => (await p.despachos.findFirst({ select: { id: true } }))?.id),
    arbol_lote: arbol?.lote_id ?? null,
    arbol_num: arbol?.numero_placa ?? null,
  };
  await p.$disconnect();
  return v;
}

// Qué entidad le corresponde a cada `[segmento]`, según dónde vive la ruta.
function concretar(ruta, v) {
  if (!ruta.includes('[')) return { url: ruta, falta: null };

  // El árbol necesita un lote que de verdad tenga ese árbol, no cualquiera.
  if (ruta.includes('[numero]')) {
    if (v.arbol_lote == null) return { url: null, falta: 'árboles' };
    return {
      url: ruta
        .replace('[lote_id]', String(v.arbol_lote))
        .replace('[id]', String(v.arbol_lote))
        .replace('[numero]', String(v.arbol_num)),
      falta: null,
    };
  }

  const contexto = () => {
    if (ruta.startsWith('/jefe/apiarios')) return ['apiarios', v.apiario];
    if (ruta.startsWith('/jefe/lotes')) return ['lotes', v.lote];
    if (ruta.startsWith('/jefe/asignaciones')) return ['asignaciones', v.asignacion];
    if (ruta.startsWith('/jefe/clientes')) return ['clientes', v.cliente];
    if (ruta.startsWith('/jefe/compras')) return ['compras', v.compra];
    if (ruta.startsWith('/jefe/equipo')) return ['personas', v.persona];
    if (ruta.startsWith('/jefe/saldos')) return ['personas', v.persona];
    if (ruta.startsWith('/jefe/instalaciones')) return ['instalaciones', v.instalacion];
    if (ruta.startsWith('/jefe/novedades')) return ['novedades', v.novedad];
    if (ruta.startsWith('/jefe/proveedores')) return ['proveedores', v.proveedor];
    if (ruta.startsWith('/jefe/servicios')) return ['servicios contratados', v.servicio];
    if (ruta.startsWith('/jefe/tareas')) return ['tipos de tarea', v.tipo_tarea];
    if (ruta.includes('/insumos/')) return ['insumos', v.insumo];
    if (ruta.includes('/herramientas/')) return ['herramientas', v.herramienta];
    if (ruta.startsWith('/bodega/despachos')) return ['despachos', v.despacho];
    if (ruta.startsWith('/trabajador')) return ['asignaciones', v.asignacion];
    return [null, null];
  };

  const [nombre, valor] = contexto();
  if (valor == null) return { url: null, falta: nombre ?? 'un valor' };
  const url = ruta.replace(/\[[^\]]+\]/g, String(valor));
  return { url, falta: url.includes('[') ? 'segmento sin resolver' : null };
}

const rolDe = (r) =>
  r.startsWith('/jefe')
    ? 'JEFE'
    : r.startsWith('/bodega')
    ? 'BODEGA'
    : r.startsWith('/trabajador')
    ? 'TRABAJADOR'
    : r.startsWith('/almacen')
    ? 'ALMACEN'
    : 'JEFE';

const CRED = {
  JEFE: E2E_JEFE,
  TRABAJADOR: E2E_TRABAJADOR,
  BODEGA: E2E_BODEGA,
  ALMACEN: E2E_ALMACEN,
};

const valores = await resolverValores();
const rutas = rutasDelCodigo();
const porRol = {};
for (const r of rutas) (porRol[rolDe(r)] ??= []).push(r);

const navegador = await chromium.launch();
const resultados = [];

for (const [rol, lista] of Object.entries(porRol)) {
  const ctx = await navegador.newContext({
    viewport: { width: ANCHO, height: 664 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.setDefaultNavigationTimeout(60000);

  let errores = [];
  p.on('pageerror', (e) => errores.push('JS: ' + String(e).slice(0, 110)));
  p.on('console', (m) => {
    if (m.type() === 'error') errores.push('consola: ' + m.text().slice(0, 110));
  });

  try {
    // 'networkidle' y no 'domcontentloaded': si se llena y se hace clic antes
    // de que hidrate, el botón no dispara nada y el login se queda esperando
    // para siempre.
    await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await p.fill('input[name="identificador"]', CRED[rol].email);
    await p.fill('input[name="password"]', CRED[rol].password);
    await p.click('button:has-text("Entrar")');
    // Se mira SOLO el pathname. Con el regex contra la URL entera, un rebote a
    // `/login?redirigir=%2Falmacen%2F...` daba por bueno el login porque la
    // palabra del rol aparece en el query string: el barrido seguía adelante
    // sin sesión y todas las pantallas salían "redirige a /login".
    await p.waitForURL((u) => /^\/(jefe|trabajador|bodega|almacen)/.test(u.pathname), {
      waitUntil: 'commit',
      timeout: 120000,
    });
  } catch {
    const visible = await p
      .locator('body')
      .innerText()
      .catch(() => '');
    const credMala = /Credenciales inválidas/i.test(visible);
    console.log(
      `[${rol}] no pudo entrar: ${
        credMala
          ? 'credenciales inválidas (¿falta sembrar este usuario?)'
          : String(e.message).slice(0, 80)
      }`
    );
    resultados.push({
      rol,
      ruta: '(login)',
      estado: 'ERROR',
      detalle: credMala ? 'no existe el usuario de prueba de este rol' : 'no pudo entrar',
    });
    await ctx.close();
    continue;
  }

  let hechas = 0;
  let sesionPerdida = false;
  for (const ruta of lista) {
    const { url, falta } = concretar(ruta, valores);
    if (!url) {
      resultados.push({ rol, ruta, estado: 'SIN DATOS', detalle: `no hay ${falta} en la base` });
      continue;
    }
    errores = [];
    const t0 = Date.now();
    let http = null;
    try {
      const r = await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
      http = r?.status() ?? null;
      await p.waitForTimeout(1200);
    } catch (e) {
      resultados.push({ rol, ruta, url, estado: 'ERROR', detalle: String(e.message).slice(0, 90) });
      continue;
    }

    // Si rebota al login, la sesión se cayó a mitad del barrido. Seguir sería
    // llenar el informe de "redirige a /login" y tapar los fallos de verdad.
    // Pasa cuando el e2e de CI corre contra esta misma base y su teardown borra
    // los usuarios de prueba compartidos.
    if (new URL(p.url()).pathname.startsWith('/login')) {
      sesionPerdida = true;
      resultados.push({
        rol,
        ruta,
        url,
        estado: 'ERROR',
        detalle: 'se perdió la sesión a mitad del barrido (¿corrió el e2e de CI?)',
      });
      break;
    }

    hechas++;
    if (hechas % 10 === 0) console.log(`[${rol}] ${hechas}/${lista.length}`);
    const ms = Date.now() - t0;
    // Si la pantalla redirige sola justo mientras se mide, el contexto muere.
    // Eso no es un fallo de la pantalla: se reintenta una vez y se sigue.
    let info;
    const medir = () =>
      p.evaluate(() => {
        const doc = document.documentElement;
        const texto = (document.body.innerText || '').replace(/\s+/g, ' ').trim();

        // Se comprueba si la pantalla SE DESLIZA DE VERDAD, no si algún
        // `scrollWidth` es mayor que su `clientWidth`.
        //
        // Esa comparación daba puros falsos positivos: la marcaban los mapas de
        // Leaflet (que scrollean por dentro a propósito), las tiras de chips de
        // filtro (que se deslizan a propósito) y los encabezados a sangre
        // completa con `-mx-4`, cuyo margen negativo derecho suma al
        // `scrollWidth` del contenedor aunque el `<main>` lo absorba. Las 15
        // pantallas que marcó la primera versión eran las 15 falsos positivos.
        //
        // Lo que sí molesta al usuario es poder arrastrar la pantalla de lado,
        // así que se intenta arrastrarla.
        const deslizable = (el) => {
          if (!el) return 0;
          const antes = el.scrollLeft;
          el.scrollLeft = 9999;
          const logrado = el.scrollLeft;
          el.scrollLeft = antes;
          return logrado;
        };
        const main = document.querySelector('main');
        const deslizaMain = deslizable(main);
        const deslizaDoc = deslizable(doc) || deslizable(document.body);

        // Además: algo que asome fuera del borde derecho de la pantalla sí es
        // un problema aunque nada scrollee, porque queda cortado.
        const w = window.innerWidth;
        const asoma = [...document.querySelectorAll('*')].find((n) => {
          const b = n.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return false;
          if (b.right <= w + 1) return false;
          // dentro de un contenedor que scrollea a propósito no cuenta
          let a = n.parentElement;
          while (a) {
            const cs = getComputedStyle(a);
            if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return false;
            a = a.parentElement;
          }
          return true;
        });

        return {
          h1: document.querySelector('h1')?.textContent?.trim() ?? null,
          largoTexto: texto.length,
          deslizaMain,
          deslizaDoc,
          asoma: asoma
            ? `${asoma.tagName.toLowerCase()}.${String(asoma.className ?? '').slice(0, 45)}`
            : null,
          urlActual: location.pathname,
        };
      });

    try {
      info = await medir();
    } catch {
      await p.waitForTimeout(1500);
      try {
        info = await medir();
      } catch {
        resultados.push({
          rol,
          ruta,
          url,
          estado: 'REVISAR',
          detalle: 'no se pudo medir: la pantalla sigue navegando sola',
        });
        continue;
      }
    }

    const problemas = [];
    if (http && http >= 400) problemas.push(`HTTP ${http}`);
    if (info.urlActual !== url.split('?')[0]) problemas.push(`redirige a ${info.urlActual}`);
    if (info.largoTexto < 40) problemas.push('pantalla casi vacía');
    if (info.deslizaMain) problemas.push(`la pantalla se desliza ${info.deslizaMain}px de lado`);
    if (info.deslizaDoc) problemas.push(`el documento se desliza ${info.deslizaDoc}px de lado`);
    if (info.asoma) problemas.push(`asoma fuera del borde: ${info.asoma}`);
    if (errores.length) problemas.push(...[...new Set(errores)].slice(0, 2));

    resultados.push({
      rol,
      ruta,
      url,
      ms,
      estado: problemas.length ? 'REVISAR' : 'ok',
      detalle: problemas.join(' · ') || (info.h1 ?? ''),
    });
  }
  if (sesionPerdida) console.log(`[${rol}] cortado: sesion perdida tras ${hechas} pantallas`);
  await ctx.close();
}
await navegador.close();

const rev = resultados.filter((r) => r.estado === 'REVISAR');
const sin = resultados.filter((r) => r.estado === 'SIN DATOS');
const err = resultados.filter((r) => r.estado === 'ERROR');
const ok = resultados.filter((r) => r.estado === 'ok');
const lentas = ok.filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms);

const L = [];
L.push(`# Barrido completo · ancho ${ANCHO}px · ${new Date().toISOString().slice(0, 16)}`);
L.push('');
L.push(
  `${resultados.length} pantallas · ${ok.length} ok · ${rev.length} a revisar · ${err.length} error · ${sin.length} sin datos`
);
L.push('');
if (rev.length) {
  L.push('## A revisar');
  rev.forEach((r) => L.push(`- **${r.url}** (${r.rol}) — ${r.detalle}`));
  L.push('');
}
if (err.length) {
  L.push('## Error al cargar');
  err.forEach((r) => L.push(`- **${r.url ?? r.ruta}** (${r.rol}) — ${r.detalle}`));
  L.push('');
}
if (lentas.length) {
  L.push('## Tiempos de primera carga');
  L.push('');
  L.push('Cada pantalla se visita una sola vez, así que esto mide sobre todo lo que');
  L.push('tarda `next dev` en compilarla por primera vez. **No sirve para juzgar la');
  L.push('velocidad real** ni para comparar con producción.');
  L.push('');
  lentas.forEach((r) => L.push(`- ${r.url} — ${(r.ms / 1000).toFixed(1)}s`));
  L.push('');
}
if (sin.length) {
  L.push('## Sin datos para probar');
  sin.forEach((r) => L.push(`- ${r.ruta} — ${r.detalle}`));
  L.push('');
}

const salida = `barrido-${ANCHO}.md`;
writeFileSync(salida, L.join('\n'), 'utf8');
console.log(L.join('\n'));
console.log(`\n-> ${salida}`);
