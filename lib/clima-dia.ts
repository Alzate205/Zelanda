// Cómo se reparte la lluvia dentro de un día, que es lo que de verdad decide
// si se puede trabajar. Un porcentaje diario no distingue entre una llovizna
// de madrugada y un aguacero a las 2 de la tarde, y son dos días distintos.

export type Franja = 'madrugada' | 'mañana' | 'tarde' | 'noche';

/**
 * Milímetros a partir de los cuales una franja de 6 h estorba el trabajo.
 * 1 mm repartido en seis horas es una llovizna con la que se sigue trabajando;
 * decirle "llueve" a eso es la misma exageración que el 100 % de antes.
 */
export const MM_FRANJA_MOJADA = 2;

/** Escala pensada para decidir, no para el noticiero. */
export type Intensidad = 'seco' | 'llovizna' | 'lluvia' | 'aguacero';

export const MM_LLOVIZNA = 1;
export const MM_LLUVIA = 5;
export const MM_AGUACERO = 15;

export function intensidad(mm: number): Intensidad {
  if (mm < MM_LLOVIZNA) return 'seco';
  if (mm < MM_LLUVIA) return 'llovizna';
  if (mm < MM_AGUACERO) return 'lluvia';
  return 'aguacero';
}

export type HoraClima = { hora: number; mm: number; prob: number };

export type BloqueLluvia = {
  franja: Franja;
  lluvia_mm: number;
  /** Probabilidad media de la franja. La máxima no sirve: casi siempre da 100. */
  prob: number;
  mojada: boolean;
};

const FRANJAS: Array<{ franja: Franja; desde: number; hasta: number }> = [
  { franja: 'madrugada', desde: 0, hasta: 6 },
  { franja: 'mañana', desde: 6, hasta: 12 },
  { franja: 'tarde', desde: 12, hasta: 18 },
  { franja: 'noche', desde: 18, hasta: 24 },
];

export function franjasDelDia(horas: HoraClima[]): BloqueLluvia[] {
  return FRANJAS.map(({ franja, desde, hasta }) => {
    const dentro = horas.filter((h) => h.hora >= desde && h.hora < hasta);
    const lluvia_mm = dentro.reduce((a, h) => a + h.mm, 0);
    const prob = dentro.length
      ? Math.round(dentro.reduce((a, h) => a + h.prob, 0) / dentro.length)
      : 0;
    return {
      franja,
      lluvia_mm: Math.round(lluvia_mm * 10) / 10,
      prob,
      mojada: lluvia_mm >= MM_FRANJA_MOJADA,
    };
  });
}

const NOMBRE: Record<Franja, string> = {
  madrugada: 'la madrugada',
  mañana: 'la mañana',
  tarde: 'la tarde',
  noche: 'la noche',
};

function listar(bloques: BloqueLluvia[]): string {
  const nombres = bloques.map((b) => NOMBRE[b.franja]);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Una frase que el jefe pueda leer de un vistazo y decidir. Deliberadamente
 * dice a qué hora, no un porcentaje: "llueve en la tarde" se puede accionar,
 * "80 % de lluvia" no.
 */
export function resumenDelDia(bloques: BloqueLluvia[]): string {
  const suma = bloques.reduce((a, b) => a + b.lluvia_mm, 0);
  const total = Math.round(suma);
  const mojadas = bloques.filter((b) => b.mojada);
  if (mojadas.length === 0) {
    // Agua que cae pero no molesta: hay que decirlo, no callarlo ni inflarlo.
    return suma >= MM_LLOVIZNA ? `Llovizna suelta (${total} mm)` : 'Día seco';
  }
  if (mojadas.length === bloques.length) return `Llueve todo el día (${total} mm)`;
  const secas = bloques.filter((b) => !b.mojada);
  return `Seco en ${listar(secas)}, llueve en ${listar(mojadas)} (${total} mm)`;
}
