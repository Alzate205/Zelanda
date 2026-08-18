import { describe, it, expect } from 'vitest';
import { periodoCubierto, etiquetaPeriodoCubierto } from './periodo-pago';

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('periodoCubierto', () => {
  it('mensual cubre el mes completo del pago', () => {
    expect(periodoCubierto('2026-08-17', 'MENSUAL')).toEqual({
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });
  });

  it('mensual respeta los meses cortos', () => {
    expect(periodoCubierto('2026-02-10', 'MENSUAL')).toEqual({
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });
  });

  it('quincenal: pagar el 15 o antes cubre la primera quincena', () => {
    expect(periodoCubierto('2026-08-15', 'QUINCENAL')).toEqual({
      desde: '2026-08-01',
      hasta: '2026-08-15',
    });
  });

  it('quincenal: pagar después del 15 cubre del 16 al cierre', () => {
    expect(periodoCubierto('2026-08-31', 'QUINCENAL')).toEqual({
      desde: '2026-08-16',
      hasta: '2026-08-31',
    });
  });

  it('semanal cubre los siete días que terminan el día del pago', () => {
    expect(periodoCubierto('2026-08-17', 'SEMANAL')).toEqual({
      desde: '2026-08-11',
      hasta: '2026-08-17',
    });
  });

  it('semanal cruza el cambio de mes', () => {
    expect(periodoCubierto('2026-09-03', 'SEMANAL')).toEqual({
      desde: '2026-08-28',
      hasta: '2026-09-03',
    });
  });

  it('devuelve null si la fecha no sirve', () => {
    expect(periodoCubierto('', 'MENSUAL')).toBeNull();
    expect(periodoCubierto('17/08/2026', 'MENSUAL')).toBeNull();
  });
});

describe('etiquetaPeriodoCubierto', () => {
  it('reconoce el mes, la quincena y la semana', () => {
    expect(etiquetaPeriodoCubierto(dia('2026-08-01'), dia('2026-08-31'))).toBe('Mensual');
    expect(etiquetaPeriodoCubierto(dia('2026-02-01'), dia('2026-02-28'))).toBe('Mensual');
    expect(etiquetaPeriodoCubierto(dia('2026-08-16'), dia('2026-08-31'))).toBe('Quincenal');
    expect(etiquetaPeriodoCubierto(dia('2026-08-11'), dia('2026-08-17'))).toBe('Semanal');
  });

  it('no le pone nombre a un rango cualquiera', () => {
    // El jefe puso las fechas a mano: la lista muestra las fechas tal cual.
    expect(etiquetaPeriodoCubierto(dia('2026-08-03'), dia('2026-08-09'))).toBe('Semanal');
    expect(etiquetaPeriodoCubierto(dia('2026-08-01'), dia('2026-08-20'))).toBeNull();
    expect(etiquetaPeriodoCubierto(dia('2026-08-01'), dia('2026-08-02'))).toBeNull();
  });
});
