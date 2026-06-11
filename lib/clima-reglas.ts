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
