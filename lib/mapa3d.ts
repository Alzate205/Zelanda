// Helpers puros del centro de control 3D. Sin dependencias de maplibre
// para poder testearlos con vitest.

export const COLOR_ESTADO_LOTE = {
  aldia: '#4e7d57',
  proxima: '#c89045',
  vencida: '#b05642',
} as const;

export type EstadoLote = keyof typeof COLOR_ESTADO_LOTE;

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
