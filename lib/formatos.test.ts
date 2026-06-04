import { describe, it, expect } from 'vitest';
import { formatearMiles, normalizarEntradaNumerica, parsearMonto } from './formatos';

describe('formatearMiles', () => {
  it('agrupa de a tres con puntos', () => {
    expect(formatearMiles('1234567')).toBe('1.234.567');
    expect(formatearMiles('1000')).toBe('1.000');
    expect(formatearMiles('999')).toBe('999');
  });

  it('maneja negativos', () => {
    expect(formatearMiles('-1234')).toBe('-1.234');
    expect(formatearMiles('-')).toBe('-');
  });

  it('vacío o no numérico devuelve vacío', () => {
    expect(formatearMiles('')).toBe('');
    expect(formatearMiles('abc')).toBe('');
  });

  it('ignora caracteres no numéricos al formatear', () => {
    expect(formatearMiles('1.234.567')).toBe('1.234.567');
    expect(formatearMiles('$ 1500000')).toBe('1.500.000');
  });
});

describe('normalizarEntradaNumerica', () => {
  it('deja solo dígitos', () => {
    expect(normalizarEntradaNumerica('1.500.000')).toBe('1500000');
    expect(normalizarEntradaNumerica('$ 50.000')).toBe('50000');
  });

  it('respeta el negativo solo cuando se permite', () => {
    expect(normalizarEntradaNumerica('-1234', true)).toBe('-1234');
    expect(normalizarEntradaNumerica('-1234', false)).toBe('1234');
  });
});

describe('parsearMonto', () => {
  it('convierte un string con miles a número', () => {
    expect(parsearMonto('1.500.000')).toBe(1_500_000);
    expect(parsearMonto('50.000')).toBe(50_000);
  });

  it('ida y vuelta: formatear → parsear es estable', () => {
    const original = 1_234_567;
    expect(parsearMonto(formatearMiles(String(original)))).toBe(original);
  });

  it('vacío devuelve NaN', () => {
    expect(Number.isNaN(parsearMonto(''))).toBe(true);
  });
});
