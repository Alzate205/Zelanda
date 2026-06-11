import { describe, it, expect } from 'vitest';
import { listaMeses } from './historia-meses';

describe('listaMeses', () => {
  it('genera los meses entre desde y hasta inclusive', () => {
    expect(listaMeses('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('mismo mes devuelve solo ese', () => {
    expect(listaMeses('2026-06', '2026-06')).toEqual(['2026-06']);
  });
  it('rango invertido devuelve vacío', () => {
    expect(listaMeses('2026-06', '2026-01')).toEqual([]);
  });
});
