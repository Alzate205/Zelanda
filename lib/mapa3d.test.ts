import { describe, it, expect } from 'vitest';
import { centroideDePoligono, rampaCosecha, COLOR_ESTADO_LOTE } from './mapa3d';

describe('centroideDePoligono', () => {
  it('devuelve el centro de un cuadrado', () => {
    const cuadrado = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-75.7, 4.5],
          [-75.6, 4.5],
          [-75.6, 4.6],
          [-75.7, 4.6],
          [-75.7, 4.5], // anillo cerrado: último == primero
        ],
      ],
    };
    const [lng, lat] = centroideDePoligono(cuadrado);
    expect(lng).toBeCloseTo(-75.65, 5);
    expect(lat).toBeCloseTo(4.55, 5);
  });
});

describe('rampaCosecha', () => {
  it('con 0 kg devuelve el color más claro', () => {
    expect(rampaCosecha(0, 1000)).toBe('#efe9dc');
  });
  it('con el máximo devuelve el color más oscuro', () => {
    expect(rampaCosecha(1000, 1000)).toBe('#86612a');
  });
  it('sin máximo (0) no divide por cero', () => {
    expect(rampaCosecha(0, 0)).toBe('#efe9dc');
  });
});

describe('COLOR_ESTADO_LOTE', () => {
  it('tiene los 3 estados del semáforo', () => {
    expect(Object.keys(COLOR_ESTADO_LOTE).sort()).toEqual(['aldia', 'proxima', 'vencida']);
  });
});
