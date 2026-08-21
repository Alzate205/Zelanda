import { describe, it, expect } from 'vitest';
import { calcularBalance, KC_AGUACATE, type DiaAgua } from './balance-hidrico';

function dias(pares: Array<[number, number]>): DiaAgua[] {
  return pares.map(([lluvia_mm, et0_mm], i) => ({
    fecha: `2026-08-${String(i + 1).padStart(2, '0')}`,
    lluvia_mm,
    et0_mm,
  }));
}

describe('calcularBalance', () => {
  it('descuenta la evapotranspiración del cultivo, no la de referencia', () => {
    // 10 mm de lluvia contra 5 mm de ET0: el aguacate pierde 5 × 0,8 = 4.
    const b = calcularBalance(dias([[10, 5]]));
    expect(b.dias[0].etc_mm).toBe(4);
    expect(b.dias[0].balance_mm).toBe(6);
  });

  it('una semana seca pide riego', () => {
    const b = calcularBalance(
      dias([
        [0, 5],
        [0, 5],
        [0, 5],
        [0, 5],
        [0, 5],
        [0, 5],
        [0, 5],
      ])
    );
    // 7 días × 4 mm perdidos = -28
    expect(b.acumulado_mm).toBe(-28);
    expect(b.estado).toBe('deficit');
    expect(b.resumen).toMatch(/conviene regar/);
  });

  it('una semana de aguaceros avisa del drenaje, no del riego', () => {
    const b = calcularBalance(
      dias([
        [80, 3],
        [90, 2],
        [40, 3],
      ])
    );
    expect(b.estado).toBe('exceso');
    expect(b.resumen).toMatch(/drenajes/);
    expect(b.resumen).not.toMatch(/regar\./);
  });

  it('lo normal es no decir nada alarmante', () => {
    const b = calcularBalance(
      dias([
        [5, 4],
        [3, 4],
        [6, 4],
      ])
    );
    expect(b.estado).toBe('equilibrio');
    expect(b.resumen).toMatch(/al día/);
  });

  it('respeta el umbral exacto del déficit', () => {
    // -20 es déficit; -19,9 todavía no.
    expect(calcularBalance(dias([[0, 25]])).estado).toBe('deficit');
    expect(calcularBalance(dias([[5, 25]])).estado).toBe('equilibrio');
  });

  it('el coeficiente de cultivo se puede calibrar', () => {
    const conDefecto = calcularBalance(dias([[0, 10]]));
    const conOtro = calcularBalance(dias([[0, 10]]), 1);
    expect(conDefecto.dias[0].etc_mm).toBe(10 * KC_AGUACATE);
    expect(conOtro.dias[0].etc_mm).toBe(10);
  });

  it('sin días no revienta', () => {
    const b = calcularBalance([]);
    expect(b.acumulado_mm).toBe(0);
    expect(b.estado).toBe('equilibrio');
  });
});
