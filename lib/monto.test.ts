import { describe, it, expect } from 'vitest';
import { parsearMontoCop } from './monto';

describe('parsearMontoCop', () => {
  it('lee montos con punto de miles', () => {
    expect(parsearMontoCop('1.250.000')).toBe(1250000);
    expect(parsearMontoCop('50.000')).toBe(50000);
    expect(parsearMontoCop('900')).toBe(900);
  });

  it('lee coma decimal', () => {
    expect(parsearMontoCop('12,5')).toBe(12.5);
    expect(parsearMontoCop('1.250,75')).toBe(1250.75);
  });

  it('devuelve null con el campo vacío en vez de cero', () => {
    // Esto era el error: un jornal sin tarifa se guardaba como jornal de $0.
    expect(parsearMontoCop('')).toBeNull();
    expect(parsearMontoCop('   ')).toBeNull();
  });

  it('rechaza lo que no es un número', () => {
    expect(parsearMontoCop('abc')).toBeNull();
    expect(parsearMontoCop('50.000 pesos')).toBeNull();
    expect(parsearMontoCop('1e6')).toBeNull();
    expect(parsearMontoCop('--5')).toBeNull();
    expect(parsearMontoCop('.')).toBeNull();
    expect(parsearMontoCop(',')).toBeNull();
  });

  it('acepta negativos, que los ajustes los necesitan', () => {
    expect(parsearMontoCop('-30.000')).toBe(-30000);
  });

  it('no confunde un decimal con punto con miles', () => {
    // "12.5" no es agrupación de miles: son doce con cinco.
    expect(parsearMontoCop('12.5')).toBe(12.5);
  });

  it('cero explícito sí es cero', () => {
    expect(parsearMontoCop('0')).toBe(0);
  });
});
