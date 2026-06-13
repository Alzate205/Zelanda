import { describe, it, expect } from 'vitest';
import { carenciasPorLote, fmtCarenciaHasta } from './carencia';

const apl = (lote_id: string, insumo: string, fecha: string, dias: number) => ({
  lote_id,
  insumo,
  fecha_aplicacion: new Date(`${fecha}T12:00:00-05:00`),
  carencia_dias: dias,
});

describe('carenciasPorLote', () => {
  it('una aplicación reciente genera carencia activa', () => {
    const r = carenciasPorLote([apl('1', 'Glifosato', '2026-06-10', 14)], '2026-06-12');
    expect(r).toEqual([{ lote_id: '1', insumo: 'Glifosato', hasta: '2026-06-24' }]);
  });
  it('una carencia vencida ayer no aparece', () => {
    expect(carenciasPorLote([apl('1', 'Glifosato', '2026-06-01', 10)], '2026-06-12')).toEqual([]);
  });
  it('el día exacto en que termina todavía está activa', () => {
    const r = carenciasPorLote([apl('1', 'Glifosato', '2026-06-02', 10)], '2026-06-12');
    expect(r[0]?.hasta).toBe('2026-06-12');
  });
  it('dos aplicaciones en el mismo lote: gana la que llega más lejos', () => {
    const r = carenciasPorLote(
      [apl('1', 'Glifosato', '2026-06-10', 5), apl('1', 'Clorpirifos', '2026-06-08', 21)],
      '2026-06-12'
    );
    expect(r).toEqual([{ lote_id: '1', insumo: 'Clorpirifos', hasta: '2026-06-29' }]);
  });
  it('carencia 0 o negativa no participa', () => {
    expect(carenciasPorLote([apl('1', 'Cal agrícola', '2026-06-12', 0)], '2026-06-12')).toEqual([]);
  });
});

describe('fmtCarenciaHasta', () => {
  it('formatea YYYY-MM-DD como DD/MM', () => {
    expect(fmtCarenciaHasta('2026-06-24')).toBe('24/06');
  });
});
