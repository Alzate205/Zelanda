// Reglas agro sobre el pronóstico. Umbrales conservadores para aguacate:
// fumigar requiere ≥6 h sin lluvia y poco viento (deriva del producto).
export type EntradaReglas = {
  lluviaProximas6hMm: number;
  probMaxProximas6h: number;
  vientoMaxHoyKmh: number;
  tminProximaNocheC: number;
};

export type ReglasAgro = {
  ventana_fumigacion: boolean;
  motivo: string;
  riesgo_helada: boolean;
};

// Umbrales de riesgo sanitario. Conservadores y pensados para calibrarse con
// la experiencia de la finca: si una alerta salta con lluvia normal, subir el número.
export const LLUVIA_72H_ENCHARCA_MM = 40;
export const HUMEDAD_ANTRACNOSIS_PCT = 85;
export const LLUVIA_48H_ANTRACNOSIS_MM = 10;

export type EntradaHongos = {
  lluvia72hMm: number;
  lluvia48hMm: number;
  humedadMedia48hPct: number;
};

export type RiesgoHongos = {
  /** Encharcamiento sostenido: condición para Phytophthora en raíz. */
  pudricion_raiz: boolean;
  /** Humedad alta con mojado foliar: condición para Colletotrichum. */
  antracnosis: boolean;
};

/**
 * Riesgo de enfermedad fúngica. Son dos cuadros distintos y no hay que
 * confundirlos: la pudrición de raíz viene del agua estancada en el suelo
 * (drenaje), mientras que la antracnosis viene de la humedad en el follaje.
 * Por eso cada una mira un dato diferente y pide una acción diferente.
 */
export function evaluarRiesgoHongos(e: EntradaHongos): RiesgoHongos {
  return {
    pudricion_raiz: e.lluvia72hMm >= LLUVIA_72H_ENCHARCA_MM,
    antracnosis:
      e.humedadMedia48hPct >= HUMEDAD_ANTRACNOSIS_PCT && e.lluvia48hMm >= LLUVIA_48H_ANTRACNOSIS_MM,
  };
}

export function evaluarReglasAgro(e: EntradaReglas): ReglasAgro {
  let ventana = true;
  let motivo = 'Buena ventana para fumigar';
  if (e.lluviaProximas6hMm >= 1 || e.probMaxProximas6h >= 40) {
    ventana = false;
    motivo = 'Lluvia en las próximas horas — no fumigues';
  } else if (e.vientoMaxHoyKmh > 15) {
    ventana = false;
    motivo = 'Mucho viento hoy — la fumigación se desvía';
  }
  return {
    ventana_fumigacion: ventana,
    motivo,
    riesgo_helada: e.tminProximaNocheC < 2,
  };
}
