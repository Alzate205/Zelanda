import { describe, it, expect } from 'vitest';
import { saludoPorHora, horaEnBogota } from './fecha';

/** Bogotá es UTC-5, así que la hora local va 5 horas detrás de la UTC. */
const aLasBogota = (hora: number) => new Date(Date.UTC(2026, 7, 3, (hora + 5) % 24, 30));

describe('horaEnBogota', () => {
  it('convierte desde UTC restando las 5 horas', () => {
    expect(horaEnBogota(new Date('2026-08-03T15:00:00Z'))).toBe(10);
    expect(horaEnBogota(new Date('2026-08-03T22:00:00Z'))).toBe(17);
  });

  it('la medianoche es 0 y no 24', () => {
    expect(horaEnBogota(new Date('2026-08-03T05:00:00Z'))).toBe(0);
  });
});

describe('saludoPorHora', () => {
  it('de madrugada y en la mañana saluda con buenos días', () => {
    for (const h of [0, 5, 8, 11]) {
      expect(saludoPorHora(aLasBogota(h))).toBe('Buenos días');
    }
  });

  it('desde el mediodía y toda la tarde, buenas tardes', () => {
    for (const h of [12, 15, 18]) {
      expect(saludoPorHora(aLasBogota(h))).toBe('Buenas tardes');
    }
  });

  it('de noche saluda con buenas noches', () => {
    for (const h of [19, 21, 23]) {
      expect(saludoPorHora(aLasBogota(h))).toBe('Buenas noches');
    }
  });

  it('cambia justo en los límites de las 12 y las 19', () => {
    expect(saludoPorHora(aLasBogota(11))).toBe('Buenos días');
    expect(saludoPorHora(aLasBogota(12))).toBe('Buenas tardes');
    expect(saludoPorHora(aLasBogota(18))).toBe('Buenas tardes');
    expect(saludoPorHora(aLasBogota(19))).toBe('Buenas noches');
  });
});
