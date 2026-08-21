// Busca lo que existe pero no hace nada visible.
//
// Esta sesión encontró tres casos así: el service worker que nunca se
// registraba, el riesgo de hongos que se calculaba y no se mostraba, y un test
// que afirmaba algo que la app nunca hizo. Ninguno daba error: simplemente no
// pasaba nada. Esto los busca a propósito.
//
//   node scripts/barrido-codigo-muerto.mjs
import { globSync } from 'glob';
import { readFileSync, writeFileSync } from 'fs';

const IGNORAR = ['node_modules/**', '.next/**', 'dist/**'];
const fuentes = globSync(
  ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx', 'components/**/*.tsx', 'hooks/**/*.ts'],
  { ignore: IGNORAR }
);

const contenido = new Map();
for (const f of fuentes) contenido.set(f.replace(/\\/g, '/'), readFileSync(f, 'utf8'));

const esTest = (f) => /\.test\.tsx?$/.test(f);
const noTest = [...contenido].filter(([f]) => !esTest(f));

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Aparece este símbolo fuera del archivo que lo define? */
function usadoFuera(simbolo, propio, { incluirTests }) {
  const re = new RegExp('\\b' + escapar(simbolo) + '\\b');
  const donde = [];
  for (const [f, c] of contenido) {
    if (f === propio) continue;
    if (!incluirTests && esTest(f)) continue;
    if (re.test(c)) donde.push(f);
  }
  return donde;
}

// ── 1. Exports que nadie importa ──────────────────────────────────────────
const huerfanos = [];
for (const [f, c] of noTest) {
  const re = /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(c)) !== null) {
    const nombre = m[1];
    const fuera = usadoFuera(nombre, f, { incluirTests: false });
    if (fuera.length > 0) continue;
    const conTests = usadoFuera(nombre, f, { incluirTests: true });
    huerfanos.push({ archivo: f, simbolo: nombre, soloTests: conTests.length > 0 });
  }
}

// ── 2. Componentes que nadie monta ────────────────────────────────────────
const compsHuerfanos = [];
for (const ruta of globSync('components/**/*.tsx', { ignore: IGNORAR })) {
  const f = ruta.replace(/\\/g, '/');
  if (esTest(f)) continue;
  const base = f.split('/').pop().replace('.tsx', '');
  if (usadoFuera(base, f, { incluirTests: false }).length === 0) compsHuerfanos.push(f);
}

// ── 3. Rutas de API que nadie llama ───────────────────────────────────────
let vercelJson = '';
try {
  vercelJson = readFileSync('vercel.json', 'utf8');
} catch {
  // sin vercel.json: no hay crons declarados
}
const rutasSinLlamar = [];
for (const ruta of globSync('app/api/**/route.ts', { ignore: IGNORAR })) {
  const f = ruta.replace(/\\/g, '/');
  const url = '/' + f.replace(/^app\//, '').replace(/\/route\.ts$/, '');
  let llamada = vercelJson.includes(url);
  if (!llamada) {
    for (const [otro, c] of contenido) {
      if (otro === f) continue;
      if (c.includes(url)) {
        llamada = true;
        break;
      }
    }
  }
  if (!llamada) rutasSinLlamar.push(url);
}

// ── 4. Campos calculados que nadie lee ────────────────────────────────────
// El patrón del riesgo de hongos: se calcula, se guarda en el tipo y ninguna
// pantalla lo lee nunca.
const camposMuertos = [];
for (const [f, c] of noTest) {
  if (!f.startsWith('lib/')) continue;
  for (const bloque of c.matchAll(/export type\s+([A-Za-z_$][\w$]*)\s*=\s*\{([^}]*)\}/g)) {
    const campos = [...bloque[2].matchAll(/^\s*([a-z_][\w]*)\??\s*:/gm)].map((x) => x[1]);
    for (const campo of campos) {
      if (campo.length < 5) continue; // nombres cortos dan demasiado ruido
      const re = new RegExp('\\.' + escapar(campo) + '\\b');
      let leido = false;
      for (const [otro, cc] of contenido) {
        if (otro === f || esTest(otro)) continue;
        if (re.test(cc)) {
          leido = true;
          break;
        }
      }
      if (!leido) camposMuertos.push({ archivo: f, tipo: bloque[1], campo });
    }
  }
}

const L = [];
L.push(`# Barrido de código que no hace nada · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
L.push('');
L.push(`${fuentes.length} archivos revisados.`);
L.push('');
L.push('> Esto no son errores: es código que existe y no se nota si desaparece.');
L.push('> Cada hallazgo hay que mirarlo a mano — algunos son deliberados.');
L.push('');

L.push(`## Exports que nadie importa (${huerfanos.length})`);
L.push('');
if (huerfanos.length === 0) L.push('_Ninguno._');
for (const h of huerfanos) {
  L.push(`- \`${h.simbolo}\` en \`${h.archivo}\`${h.soloTests ? ' — **solo lo usan los tests**' : ''}`);
}
L.push('');

L.push(`## Componentes que nadie monta (${compsHuerfanos.length})`);
L.push('');
if (compsHuerfanos.length === 0) L.push('_Ninguno._');
for (const c of compsHuerfanos) L.push(`- \`${c}\``);
L.push('');

L.push(`## Rutas de API que nadie llama (${rutasSinLlamar.length})`);
L.push('');
if (rutasSinLlamar.length === 0) L.push('_Ninguna._');
for (const r of rutasSinLlamar) L.push(`- \`${r}\``);
L.push('');

L.push(`## Campos calculados que nadie lee (${camposMuertos.length})`);
L.push('');
L.push('_Es el patrón del riesgo de hongos: se calculaba y ninguna pantalla lo mostraba._');
L.push('');
if (camposMuertos.length === 0) L.push('_Ninguno._');
for (const c of camposMuertos) L.push(`- \`${c.tipo}.${c.campo}\` en \`${c.archivo}\``);

const salida = L.join('\n');
console.log(salida);
writeFileSync('barrido-codigo-muerto.md', salida, 'utf8');
