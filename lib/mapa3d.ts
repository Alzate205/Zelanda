// Helpers puros del centro de control 3D. Sin dependencias de maplibre
// para poder testearlos con vitest.

export const COLOR_ESTADO_LOTE = {
  aldia: '#4e7d57',
  proxima: '#c89045',
  vencida: '#b05642',
} as const;

export type EstadoLote = keyof typeof COLOR_ESTADO_LOTE;

/**
 * Color del borde según el estado de tareas.
 *
 * El relleno pasó a identificar al lote, así que el estado se mudó acá. Son
 * versiones más claras y saturadas que las del relleno: el borde es una línea
 * fina sobre imágenes de satélite oscuras y necesita brillo propio para leerse.
 */
export const COLOR_BORDE_ESTADO = {
  aldia: '#ffffff',
  proxima: '#f0b429',
  vencida: '#e8574a',
} as const;

// La paleta de identidad de los lotes vive en lib/paleta-lotes.ts, que ya la
// compartían los mapas 2D. Acá solo queda el color del borde, que es lo propio
// del centro de control.

type Poligono = { type: 'Polygon'; coordinates: number[][][] };

/** Centro (promedio de vértices del anillo exterior, sin contar el cierre). */
export function centroideDePoligono(p: Poligono): [number, number] {
  const anillo = p.coordinates[0];
  const n = anillo.length;
  const cerrado = n > 1 && anillo[0][0] === anillo[n - 1][0] && anillo[0][1] === anillo[n - 1][1];
  const vertices = cerrado ? anillo.slice(0, -1) : anillo;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of vertices) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / vertices.length, sumLat / vertices.length];
}

const RAMPA: Array<[number, [number, number, number]]> = [
  [0, [0xef, 0xe9, 0xdc]],
  [0.5, [0xc1, 0x96, 0x58]],
  [1, [0x86, 0x61, 0x2a]],
];

/** Color para el modo cosecha: interpola beige → ocre → café según kg/maxKg. */
export function rampaCosecha(kg: number, maxKg: number): string {
  const t = maxKg <= 0 ? 0 : Math.min(1, Math.max(0, kg / maxKg));
  let i = 0;
  while (i < RAMPA.length - 2 && t > RAMPA[i + 1][0]) i++;
  const [t0, c0] = RAMPA[i];
  const [t1, c1] = RAMPA[i + 1];
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  const rgb = c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// === Dónde poner el nombre de un lote ===
//
// El promedio de los vértices sirve para "más o menos por acá", pero no para
// rotular: en un lote alargado, curvo o con forma de L, ese punto cae fuera del
// polígono. En el mapa eso se ve como el nombre de un lote escrito encima del
// lote de al lado, que es peor que no ponerlo.
//
// Lo que hace falta es el punto interior más alejado de cualquier borde —el
// "polo de inaccesibilidad"—, que es donde más espacio libre hay para escribir
// y que por construcción siempre está adentro. Se busca partiendo el polígono
// en celdas y afinando siempre la más prometedora.

type Celda = {
  x: number;
  y: number;
  /** Media celda: lo que se suma o resta para llegar a sus bordes. */
  h: number;
  /** Distancia del centro de la celda al borde del polígono (negativa si está fuera). */
  d: number;
  /** Cota superior de lo que podría dar cualquier punto de esta celda. */
  max: number;
};

/** Distancia al cuadrado de un punto al segmento a-b. */
function distanciaCuadradaASegmento(x: number, y: number, a: number[], b: number[]): number {
  let px = a[0];
  let py = a[1];
  const dx = b[0] - px;
  const dy = b[1] - py;
  if (dx !== 0 || dy !== 0) {
    const t = ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      px = b[0];
      py = b[1];
    } else if (t > 0) {
      px += dx * t;
      py += dy * t;
    }
  }
  return (x - px) ** 2 + (y - py) ** 2;
}

/**
 * Distancia del punto al borde del polígono: positiva adentro, negativa afuera.
 * Tiene en cuenta todos los anillos, así que un lote con un hueco adentro
 * tampoco recibe el nombre en el hueco.
 */
function distanciaAlBorde(x: number, y: number, anillos: number[][][]): number {
  let dentro = false;
  let minCuadrado = Infinity;
  for (const anillo of anillos) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const a = anillo[i];
      const b = anillo[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
        dentro = !dentro;
      }
      minCuadrado = Math.min(minCuadrado, distanciaCuadradaASegmento(x, y, a, b));
    }
  }
  const dist = Math.sqrt(minCuadrado);
  return dentro ? dist : -dist;
}

function celda(x: number, y: number, h: number, anillos: number[][][]): Celda {
  const d = distanciaAlBorde(x, y, anillos);
  // Ningún punto de la celda puede estar más lejos del borde que su centro más
  // la media diagonal. Esa cota es lo que permite descartar celdas enteras.
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

/**
 * Punto para escribir el nombre del lote: dentro del polígono y en la zona con
 * más aire alrededor.
 */
export function centroVisualDePoligono(p: Poligono): [number, number] {
  const anillos = p.coordinates;
  const exterior = anillos[0];
  if (!exterior || exterior.length === 0) return centroideDePoligono(p);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of exterior) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const ancho = maxX - minX;
  const alto = maxY - minY;
  const lado = Math.min(ancho, alto);
  if (lado === 0) return centroideDePoligono(p);

  // Afinar más allá de la milésima del lote no cambia dónde se ve la etiqueta.
  const precision = lado / 1000;
  let h = lado / 2;

  // Se arranca cubriendo el rectángulo con celdas del mismo tamaño.
  const pendientes: Celda[] = [];
  for (let x = minX; x < maxX; x += h) {
    for (let y = minY; y < maxY; y += h) {
      pendientes.push(celda(x + h / 2, y + h / 2, h / 2, anillos));
    }
  }

  // El centroide es un buen candidato inicial: en los lotes convexos suele ser
  // ya la respuesta, y ahorra vueltas.
  const [cx, cy] = centroideDePoligono(p);
  let mejor = celda(cx, cy, 0, anillos);

  // Tope de seguridad: un polígono con miles de vértices no puede dejar la
  // pantalla colgada por una etiqueta.
  let vueltas = 0;
  while (pendientes.length > 0 && vueltas < 10000) {
    vueltas++;
    // La más prometedora primero.
    let iMejor = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if (pendientes[i].max > pendientes[iMejor].max) iMejor = i;
    }
    const actual = pendientes.splice(iMejor, 1)[0];

    if (actual.d > mejor.d) mejor = actual;
    // Ni el mejor punto posible de esta celda supera a lo que ya tenemos.
    if (actual.max - mejor.d <= precision) continue;

    h = actual.h / 2;
    pendientes.push(celda(actual.x - h, actual.y - h, h, anillos));
    pendientes.push(celda(actual.x + h, actual.y - h, h, anillos));
    pendientes.push(celda(actual.x - h, actual.y + h, h, anillos));
    pendientes.push(celda(actual.x + h, actual.y + h, h, anillos));
  }

  return [mejor.x, mejor.y];
}
