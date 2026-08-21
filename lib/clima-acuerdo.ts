// Cuánto creerle al número de lluvia de un día.
//
// Se probó primero con el ensemble de GFS (31 corridas del mismo modelo) y no
// servía: los 31 coincidían todos los días y la confianza salía constante, que
// es el mismo defecto que tenía el "100 % de probabilidad" de antes.
//
// Lo que sí varía es el desacuerdo ENTRE modelos distintos. Para el 25 de
// agosto de 2026 sobre la finca: ECMWF 62 mm, GFS 9,3 mm, ICON 2,1 mm. Cuando
// los modelos se separan así, el número que enseña la app no se puede presentar
// como un hecho.

export type Confianza = 'alta' | 'media' | 'baja';

/**
 * Umbrales en milímetros de diferencia entre el modelo más seco y el más
 * lluvioso del día. Están puestos por lo que cambia una decisión, no por
 * estadística: por debajo de 10 mm de diferencia todos los modelos describen
 * el mismo día de trabajo; por encima de 30 describen días opuestos.
 */
export const MM_ACUERDO_ALTO = 10;
export const MM_ACUERDO_MEDIO = 30;

export type Acuerdo = {
  min_mm: number;
  max_mm: number;
  /** Cuántos modelos contestaron. */
  modelos: number;
  confianza: Confianza;
};

export function medirAcuerdo(valores: number[]): Acuerdo | null {
  const validos = valores.filter((v) => Number.isFinite(v));
  if (validos.length < 3) return null; // con menos de tres no hay desacuerdo que medir

  const min = Math.min(...validos);
  const max = Math.max(...validos);
  const rango = max - min;

  return {
    min_mm: Math.round(min * 10) / 10,
    max_mm: Math.round(max * 10) / 10,
    modelos: validos.length,
    confianza: rango <= MM_ACUERDO_ALTO ? 'alta' : rango <= MM_ACUERDO_MEDIO ? 'media' : 'baja',
  };
}

/**
 * Sin varios modelos hay que caer en algo, y lo único que se sabe es que el
 * pronóstico se degrada con la distancia. Es un supuesto, no una medición.
 */
export function confianzaPorDistancia(indice: number): Confianza {
  if (indice <= 1) return 'alta';
  if (indice <= 3) return 'media';
  return 'baja';
}
