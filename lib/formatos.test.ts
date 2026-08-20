import { describe, it, expect } from 'vitest';
import { formatearCantidad, formatearDecimal, parsearDecimal } from './formatos';

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

describe('formatearCantidad', () => {
  it('lee el decimal de Postgres sin inventar miles', () => {
    // El bug real: NUMERIC(12,3) guarda diez litros como "10.000", y pintado
    // tal cual en español se leía "diez mil".
    expect(formatearCantidad('10.000')).toBe('10');
    expect(formatearCantidad('0.500')).toBe('0,5');
    expect(formatearCantidad('1.250')).toBe('1,25');
  });

  it('sí pone separador de miles cuando el número es grande de verdad', () => {
    expect(formatearCantidad('10000.000')).toBe('10.000');
    expect(formatearCantidad(1234567)).toBe('1.234.567');
  });

  it('no rompe con valores vacíos o inválidos', () => {
    expect(formatearCantidad(null)).toBe('0');
    expect(formatearCantidad(undefined)).toBe('0');
    expect(formatearCantidad('')).toBe('0');
    expect(formatearCantidad('abc')).toBe('0');
  });
});

describe('formatearDecimal', () => {
  it('usa coma decimal, no punto', () => {
    // toFixed() escribía "5.6", que en la misma pantalla que "$ 1.000.000"
    // deja al punto significando dos cosas distintas.
    expect(formatearDecimal(5.6)).toBe('5,6');
    expect(formatearDecimal(-402, 1)).toBe('-402,0');
  });

  it('pone punto de miles', () => {
    expect(formatearDecimal(1250.5)).toBe('1.250,5');
    expect(formatearDecimal(12345.67, 2)).toBe('12.345,67');
  });

  it('respeta la cantidad de decimales pedida', () => {
    expect(formatearDecimal(3, 0)).toBe('3');
    expect(formatearDecimal(3.456, 2)).toBe('3,46');
  });

  it('no rompe con valores inválidos', () => {
    expect(formatearDecimal(null)).toBe('0');
    expect(formatearDecimal('abc')).toBe('0');
  });
});
