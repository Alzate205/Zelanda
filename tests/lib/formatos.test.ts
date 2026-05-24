import { describe, it, expect } from 'vitest';
import { formatearMiles, normalizarEntradaNumerica, parsearMonto } from '@/lib/formatos';

describe('lib/formatos', () => {
  it('formatea miles correctamente', () => {
    expect(formatearMiles('1234567')).toBe('1.234.567');
    expect(formatearMiles('-1234')).toBe('-1.234');
    expect(formatearMiles('')).toBe('');
    expect(formatearMiles('abc')).toBe('');
  });

  it('normaliza entrada numerica', () => {
    expect(normalizarEntradaNumerica('1.234.567', true)).toBe('1234567');
    expect(normalizarEntradaNumerica('-1.234', true)).toBe('-1234');
    expect(normalizarEntradaNumerica('1.234', false)).toBe('1234');
    expect(normalizarEntradaNumerica('abc', true)).toBe('');
  });

  it('parsea monto', () => {
    expect(parsearMonto('1.234.567')).toBe(1234567);
    expect(Number.isNaN(parsearMonto(''))).toBe(true);
    expect(Number.isNaN(parsearMonto('abc'))).toBe(true);
  });
});
