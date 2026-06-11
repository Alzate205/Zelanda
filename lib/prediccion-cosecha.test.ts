import { describe, it, expect } from 'vitest';
import { predecirCosecha } from './prediccion-cosecha';

describe('predecirCosecha', () => {
  it('sin datos devuelve null', () => {
    expect(predecirCosecha([])).toBeNull();
  });
  it('un solo año: esperado = ese año, confianza baja', () => {
    const p = predecirCosecha([{ anio: 2025, kg: 1000 }]);
    expect(p?.kg_esperado).toBe(1000);
    expect(p?.confianza).toBe('baja');
  });
  it('serie creciente: el esperado sigue la tendencia (más que el promedio simple)', () => {
    const p = predecirCosecha([
      { anio: 2023, kg: 800 },
      { anio: 2024, kg: 1000 },
      { anio: 2025, kg: 1200 },
    ]);
    expect(p?.confianza).toBe('alta');
    // promedio ponderado (3·1200+2·1000+1·800)/6 = 1066,7 + tendencia media (+200) = ~1266,7
    expect(p?.kg_esperado).toBeGreaterThan(1100);
    expect(p?.kg_min).toBeLessThan(p!.kg_esperado);
    expect(p?.kg_max).toBeGreaterThan(p!.kg_esperado);
  });
  it('dos años: confianza media', () => {
    expect(
      predecirCosecha([
        { anio: 2024, kg: 500 },
        { anio: 2025, kg: 700 },
      ])?.confianza
    ).toBe('media');
  });
});
