import { describe, it, expect } from 'vitest';
import { evaluarReglasAgro, evaluarRiesgoHongos } from './clima-reglas';

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

describe('evaluarRiesgoHongos', () => {
  const seco = { lluvia72hMm: 2, lluvia48hMm: 1, humedadMedia48hPct: 60 };

  it('con tiempo seco no hay ningún riesgo', () => {
    const r = evaluarRiesgoHongos(seco);
    expect(r.pudricion_raiz).toBe(false);
    expect(r.antracnosis).toBe(false);
  });

  it('lluvia acumulada alta encharca y arriesga la raíz', () => {
    const r = evaluarRiesgoHongos({ ...seco, lluvia72hMm: 55 });
    expect(r.pudricion_raiz).toBe(true);
  });

  it('el umbral de encharcamiento es inclusivo', () => {
    expect(evaluarRiesgoHongos({ ...seco, lluvia72hMm: 40 }).pudricion_raiz).toBe(true);
    expect(evaluarRiesgoHongos({ ...seco, lluvia72hMm: 39.9 }).pudricion_raiz).toBe(false);
  });

  it('la antracnosis necesita humedad alta Y lluvia, no una sola', () => {
    expect(
      evaluarRiesgoHongos({ ...seco, humedadMedia48hPct: 90, lluvia48hMm: 0 }).antracnosis
    ).toBe(false);
    expect(
      evaluarRiesgoHongos({ ...seco, humedadMedia48hPct: 50, lluvia48hMm: 30 }).antracnosis
    ).toBe(false);
    expect(
      evaluarRiesgoHongos({ ...seco, humedadMedia48hPct: 90, lluvia48hMm: 12 }).antracnosis
    ).toBe(true);
  });

  it('un aguacero puntual dispara raíz pero no antracnosis si el aire está seco', () => {
    const r = evaluarRiesgoHongos({
      lluvia72hMm: 60,
      lluvia48hMm: 55,
      humedadMedia48hPct: 55,
    });
    expect(r.pudricion_raiz).toBe(true);
    expect(r.antracnosis).toBe(false);
  });
});
