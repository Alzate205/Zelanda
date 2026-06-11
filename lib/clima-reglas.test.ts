import { describe, it, expect } from 'vitest';
import { evaluarReglasAgro } from './clima-reglas';

describe('evaluarReglasAgro', () => {
  it('con cielo seco y calmo hay ventana de fumigación', () => {
    const r = evaluarReglasAgro({
      lluviaProximas6hMm: 0,
      probMaxProximas6h: 10,
      vientoMaxHoyKmh: 8,
      tminProximaNocheC: 12,
    });
    expect(r.ventana_fumigacion).toBe(true);
    expect(r.riesgo_helada).toBe(false);
  });
  it('lluvia próxima bloquea la fumigación', () => {
    const r = evaluarReglasAgro({
      lluviaProximas6hMm: 3,
      probMaxProximas6h: 80,
      vientoMaxHoyKmh: 5,
      tminProximaNocheC: 12,
    });
    expect(r.ventana_fumigacion).toBe(false);
    expect(r.motivo).toMatch(/lluvia/i);
  });
  it('viento fuerte bloquea la fumigación', () => {
    const r = evaluarReglasAgro({
      lluviaProximas6hMm: 0,
      probMaxProximas6h: 5,
      vientoMaxHoyKmh: 22,
      tminProximaNocheC: 12,
    });
    expect(r.ventana_fumigacion).toBe(false);
    expect(r.motivo).toMatch(/viento/i);
  });
  it('detecta riesgo de helada', () => {
    const r = evaluarReglasAgro({
      lluviaProximas6hMm: 0,
      probMaxProximas6h: 5,
      vientoMaxHoyKmh: 5,
      tminProximaNocheC: 1.5,
    });
    expect(r.riesgo_helada).toBe(true);
  });
});
