import { describe, it, expect } from 'vitest';
import { franjasDelDia, resumenDelDia, intensidad, type HoraClima } from './clima-dia';

function dia(mmPorHora: number[], prob = 50): HoraClima[] {
  return mmPorHora.map((mm, hora) => ({ hora, mm, prob }));
}

describe('franjasDelDia', () => {
  it('reparte la lluvia en madrugada, mañana, tarde y noche', () => {
    // 2 mm en cada hora de la tarde (12-17), nada más.
    const horas = dia(Array.from({ length: 24 }, (_, h) => (h >= 12 && h < 18 ? 2 : 0)));
    const b = franjasDelDia(horas);
    expect(b.map((x) => x.franja)).toEqual(['madrugada', 'mañana', 'tarde', 'noche']);
    expect(b[2].lluvia_mm).toBe(12);
    expect(b[2].mojada).toBe(true);
    expect(b[1].lluvia_mm).toBe(0);
    expect(b[1].mojada).toBe(false);
  });

  it('promedia la probabilidad en vez de quedarse con el pico', () => {
    const horas: HoraClima[] = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      mm: 0,
      prob: hora === 14 ? 100 : 10,
    }));
    const tarde = franjasDelDia(horas)[2];
    // Una hora al 100 % y cinco al 10 % no es una tarde al 100 %.
    expect(tarde.prob).toBe(25);
  });

  it('una llovizna repartida no moja la franja', () => {
    // 0,3 mm por hora durante seis horas = 1,8 mm: se sigue trabajando.
    const horas = dia(Array.from({ length: 24 }, (_, h) => (h >= 6 && h < 12 ? 0.3 : 0)));
    expect(franjasDelDia(horas)[1].mojada).toBe(false);
    const horasFuerte = dia(Array.from({ length: 24 }, (_, h) => (h >= 6 && h < 12 ? 0.5 : 0)));
    expect(franjasDelDia(horasFuerte)[1].mojada).toBe(true);
  });
});

describe('resumenDelDia', () => {
  it('día sin lluvia', () => {
    expect(resumenDelDia(franjasDelDia(dia(new Array(24).fill(0))))).toBe('Día seco');
  });

  it('no llama lluvia a una llovizna repartida en todo el día', () => {
    // 6 mm en 24 h es llovizna: decir "llueve todo el día" espanta al jefe
    // de un día en el que sí se puede trabajar.
    const horas = dia(new Array(24).fill(0.25));
    expect(resumenDelDia(franjasDelDia(horas))).toBe('Llovizna suelta (6 mm)');
  });

  it('día entero de lluvia dice cuántos mm', () => {
    const r = resumenDelDia(franjasDelDia(dia(new Array(24).fill(3))));
    expect(r).toBe('Llueve todo el día (72 mm)');
  });

  it('dice a qué hora llueve, que es lo accionable', () => {
    const horas = dia(Array.from({ length: 24 }, (_, h) => (h >= 12 && h < 18 ? 3 : 0)));
    expect(resumenDelDia(franjasDelDia(horas))).toBe(
      'Seco en la madrugada, la mañana y la noche, llueve en la tarde (18 mm)'
    );
  });

  it('junta bien dos franjas mojadas', () => {
    const horas = dia(Array.from({ length: 24 }, (_, h) => (h >= 12 ? 3 : 0)));
    expect(resumenDelDia(franjasDelDia(horas))).toBe(
      'Seco en la madrugada y la mañana, llueve en la tarde y la noche (36 mm)'
    );
  });
});

describe('intensidad', () => {
  it('escala pensada para decidir', () => {
    expect(intensidad(0)).toBe('seco');
    expect(intensidad(0.5)).toBe('seco');
    expect(intensidad(3)).toBe('llovizna');
    expect(intensidad(9)).toBe('lluvia');
    expect(intensidad(40)).toBe('aguacero');
  });
});
