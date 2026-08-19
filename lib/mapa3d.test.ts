import { describe, it, expect } from 'vitest';
import {
  centroideDePoligono,
  centroVisualDePoligono,
  rampaCosecha,
  COLOR_BORDE_ESTADO,
  COLOR_ESTADO_LOTE,
} from './mapa3d';

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

describe('COLOR_BORDE_ESTADO', () => {
  it('cada estado tiene un color de borde distinto', () => {
    const bordes = Object.values(COLOR_BORDE_ESTADO);
    expect(new Set(bordes).size).toBe(bordes.length);
  });
});

describe('centroVisualDePoligono', () => {
  const dentroDe = (p: [number, number], anillo: number[][]) => {
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const a = anillo[i];
      const b = anillo[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      ) {
        dentro = !dentro;
      }
    }
    return dentro;
  };

  it('en un cuadrado cae en el centro', () => {
    const cuadrado = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    };
    const [x, y] = centroVisualDePoligono(cuadrado);
    expect(x).toBeCloseTo(5, 1);
    expect(y).toBeCloseTo(5, 1);
  });

  it('en un lote en forma de L queda adentro, donde el promedio de vértices no', () => {
    // Este es el caso que se veía en el mapa: el nombre de un lote escrito
    // encima del lote de al lado.
    const ele = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 3],
          [3, 3],
          [3, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    };
    const anillo = ele.coordinates[0];
    expect(dentroDe(centroideDePoligono(ele), anillo)).toBe(false);
    expect(dentroDe(centroVisualDePoligono(ele), anillo)).toBe(true);
  });

  it('en una franja angosta y curvada queda adentro', () => {
    const curva = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 2],
          [8, 2],
          [8, 8],
          [10, 8],
          [10, 10],
          [0, 10],
          [0, 8],
          [6, 8],
          [6, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    };
    expect(dentroDe(centroVisualDePoligono(curva), curva.coordinates[0])).toBe(true);
  });

  it('no se cuelga con un polígono degenerado', () => {
    const plano = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [1, 1],
          [1, 1],
          [1, 1],
        ],
      ],
    };
    expect(centroVisualDePoligono(plano)).toEqual([1, 1]);
  });
});
