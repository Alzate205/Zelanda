// Balance hídrico del lote: cuánta agua entró por lluvia contra cuánta se fue
// por evaporación y por la planta. Es la diferencia entre regar por costumbre y
// regar porque hace falta.
//
// ET0 es la evapotranspiración de referencia que publica Open-Meteo siguiendo
// el método FAO-56: el agua que perdería un pasto bien regado. El aguacate no
// es pasto, así que se ajusta con un coeficiente de cultivo (Kc).

/**
 * Coeficiente de cultivo del aguacate en producción.
 *
 * FAO-56 da entre 0,75 y 0,85 para huertos maduros según cuánto suelo cubra la
 * copa. 0,8 es el punto medio y es una aproximación, no una medición: si en la
 * finca se ve que el riego se queda corto o sobra, este es el número a mover.
 */
export const KC_AGUACATE = 0.8;

/** Déficit acumulado a partir del cual el lote pide agua. */
export const MM_DEFICIT = -20;

/**
 * Excedente a partir del cual el problema deja de ser la sequía y pasa a ser el
 * encharcamiento. Se alinea con LLUVIA_72H_ENCHARCA_MM de clima-reglas.
 */
export const MM_EXCESO = 40;

export type DiaAgua = {
  fecha: string;
  /** Lluvia caída o pronosticada, en mm. */
  lluvia_mm: number;
  /** ET0 de referencia (FAO-56), en mm. */
  et0_mm: number;
};

export type DiaBalance = DiaAgua & {
  /** Lo que de verdad pierde el aguacate: ET0 × Kc. */
  etc_mm: number;
  /** Lo que entró menos lo que se fue, ese día. */
  balance_mm: number;
};

export type EstadoAgua = 'deficit' | 'equilibrio' | 'exceso';

export type BalanceHidrico = {
  dias: DiaBalance[];
  /** Suma del balance en la ventana mirada, en mm. */
  acumulado_mm: number;
  estado: EstadoAgua;
  /** Frase corta y accionable para el jefe. */
  resumen: string;
};

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calcularBalance(dias: DiaAgua[], kc = KC_AGUACATE): BalanceHidrico {
  const detalle: DiaBalance[] = dias.map((d) => {
    const etc = d.et0_mm * kc;
    return {
      ...d,
      etc_mm: redondear(etc),
      balance_mm: redondear(d.lluvia_mm - etc),
    };
  });

  const acumulado = redondear(detalle.reduce((a, d) => a + d.balance_mm, 0));
  const estado: EstadoAgua =
    acumulado <= MM_DEFICIT ? 'deficit' : acumulado >= MM_EXCESO ? 'exceso' : 'equilibrio';

  return { dias: detalle, acumulado_mm: acumulado, estado, resumen: frase(estado, acumulado) };
}

function frase(estado: EstadoAgua, acumulado: number): string {
  const mm = Math.abs(Math.round(acumulado));
  if (estado === 'deficit') {
    return `Al lote le faltan ${mm} mm: conviene regar.`;
  }
  if (estado === 'exceso') {
    // Con esta agua encima el riesgo ya no es la sequía sino la raíz.
    return `Sobran ${mm} mm de agua. No riegues y revisá que los drenajes corran.`;
  }
  return acumulado >= 0
    ? `El lote está al día: le sobran ${mm} mm. No hace falta regar.`
    : `El lote está al día: le faltan ${mm} mm. Todavía no hace falta regar.`;
}
