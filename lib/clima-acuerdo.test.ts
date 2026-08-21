import { describe, it, expect } from 'vitest';
import { medirAcuerdo, confianzaPorDistancia } from './clima-acuerdo';

describe('medirAcuerdo', () => {
  it('modelos que coinciden: confianza alta', () => {
    const a = medirAcuerdo([5.4, 3.7, 5.5, 1.7, 0, 3.1])!;
    expect(a.min_mm).toBe(0);
    expect(a.max_mm).toBe(5.5);
    expect(a.confianza).toBe('alta');
  });

  it('modelos que describen días opuestos: confianza baja', () => {
    // Caso real de la finca el 25-ago-2026: ECMWF 62, ICON 2,1.
    const a = medirAcuerdo([93.9, 62, 9.3, 2.1, 21.8])!;
    expect(a.confianza).toBe('baja');
    expect(a.min_mm).toBe(2.1);
    expect(a.max_mm).toBe(93.9);
  });

  it('desacuerdo intermedio', () => {
    expect(medirAcuerdo([2, 10, 22])!.confianza).toBe('media');
  });

  it('coincidir en que llueve mucho también es coincidir', () => {
    // Todos dicen aguacero: el número es grande pero el día está claro.
    expect(medirAcuerdo([80, 82, 85, 84])!.confianza).toBe('alta');
  });

  it('con menos de tres modelos no opina', () => {
    expect(medirAcuerdo([5, 10])).toBeNull();
    expect(medirAcuerdo([])).toBeNull();
  });

  it('ignora huecos del proveedor', () => {
    const a = medirAcuerdo([5, NaN, 7, 9])!;
    expect(a.modelos).toBe(3);
  });

  it('respeta los umbrales exactos', () => {
    expect(medirAcuerdo([0, 5, 10])!.confianza).toBe('alta');
    expect(medirAcuerdo([0, 5, 10.1])!.confianza).toBe('media');
    expect(medirAcuerdo([0, 5, 30])!.confianza).toBe('media');
    expect(medirAcuerdo([0, 5, 30.1])!.confianza).toBe('baja');
  });
});

describe('confianzaPorDistancia', () => {
  it('es el respaldo cuando no hay varios modelos', () => {
    expect(confianzaPorDistancia(0)).toBe('alta');
    expect(confianzaPorDistancia(3)).toBe('media');
    expect(confianzaPorDistancia(6)).toBe('baja');
  });
});
