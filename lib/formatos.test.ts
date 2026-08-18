import { describe, it, expect } from 'vitest';
import { parsearDecimal } from './formatos';

describe('parsearDecimal', () => {
  it('acepta la coma que manda el teclado en español', () => {
    // El caso real: medio kilo de miel llegaba como cero y el formulario
    // respondía que la cantidad debía ser positiva.
    expect(parsearDecimal('0,5')).toBe(0.5);
    expect(parsearDecimal('12,75')).toBe(12.75);
  });

  it('acepta el punto de siempre', () => {
    expect(parsearDecimal('0.5')).toBe(0.5);
    expect(parsearDecimal('0.001')).toBe(0.001);
  });

  it('acepta enteros y espacios alrededor', () => {
    expect(parsearDecimal('7')).toBe(7);
    expect(parsearDecimal('  7,5  ')).toBe(7.5);
  });

  it('rechaza lo que no es un número', () => {
    expect(parsearDecimal('')).toBeNaN();
    expect(parsearDecimal('abc')).toBeNaN();
    expect(parsearDecimal('1.2.3')).toBeNaN();
    expect(parsearDecimal(',')).toBeNaN();
  });

  it('deja pasar el negativo para que lo rechace quien valida', () => {
    expect(parsearDecimal('-3,5')).toBe(-3.5);
  });
});
