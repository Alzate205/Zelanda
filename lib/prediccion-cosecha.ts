// Predicción simple del próximo ciclo por lote: promedio ponderado de los
// últimos 3 años (pesos 3-2-1, más reciente pesa más) + la tendencia media
// entre años. Mejora sola a medida que se acumulan datos.

export type PrediccionCosecha = {
  kg_min: number;
  kg_esperado: number;
  kg_max: number;
  confianza: 'alta' | 'media' | 'baja';
};

const MARGEN: Record<PrediccionCosecha['confianza'], number> = {
  alta: 0.15,
  media: 0.25,
  baja: 0.4,
};

export function predecirCosecha(
  kgPorAnio: { anio: number; kg: number }[]
): PrediccionCosecha | null {
  const serie = [...kgPorAnio].sort((a, b) => a.anio - b.anio).filter((s) => s.kg > 0);
  if (serie.length === 0) return null;

  const ultimos = serie.slice(-3);
  const pesos = [1, 2, 3].slice(-ultimos.length);
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  const ponderado = ultimos.reduce((acc, s, i) => acc + s.kg * pesos[i], 0) / sumaPesos;

  let tendencia = 0;
  if (ultimos.length >= 2) {
    const deltas = [];
    for (let i = 1; i < ultimos.length; i++) deltas.push(ultimos[i].kg - ultimos[i - 1].kg);
    tendencia = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }

  const esperado = Math.max(0, ponderado + tendencia);
  const confianza: PrediccionCosecha['confianza'] =
    serie.length >= 3 ? 'alta' : serie.length === 2 ? 'media' : 'baja';
  const margen = esperado * MARGEN[confianza];

  return {
    kg_min: Math.round(Math.max(0, esperado - margen)),
    kg_esperado: Math.round(esperado),
    kg_max: Math.round(esperado + margen),
    confianza,
  };
}
