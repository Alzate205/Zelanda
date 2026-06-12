import { describe, it, expect } from 'vitest';
import { costoAplicacion, agruparCostoPorLote } from './aplicaciones';

describe('costoAplicacion', () => {
  it('usa el costo congelado al cierre si existe', () => {
    expect(costoAplicacion(2, 5000, 9000)).toBe(10000);
  });
  it('cae al costo actual si no hay snapshot (cierres pre-migración)', () => {
    expect(costoAplicacion(2, null, 9000)).toBe(18000);
  });
  it('sin ningún costo conocido vale 0', () => {
    expect(costoAplicacion(2, null, null)).toBe(0);
  });
});

describe('agruparCostoPorLote', () => {
  it('suma por lote y ordena de mayor a menor', () => {
    const r = agruparCostoPorLote([
      { lote_id: '1', lote_nombre: 'Salento', costo: 10000 },
      { lote_id: '2', lote_nombre: 'Pijao', costo: 50000 },
      { lote_id: '1', lote_nombre: 'Salento', costo: 5000 },
    ]);
    expect(r).toEqual([
      { lote_id: '2', nombre: 'Pijao', costo: 50000 },
      { lote_id: '1', nombre: 'Salento', costo: 15000 },
    ]);
  });
  it('ignora aplicaciones sin lote', () => {
    expect(agruparCostoPorLote([{ lote_id: null, lote_nombre: null, costo: 9999 }])).toEqual([]);
  });
});
