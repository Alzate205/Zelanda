import { describe, it, expect } from 'vitest';
import { tandasDePlacas, TAMANO_TANDA_ARBOLES } from './arboles';

describe('tandasDePlacas', () => {
  it('devuelve una sola tanda cuando cabe', () => {
    expect(tandasDePlacas(1, 5, 1000)).toEqual([[1, 2, 3, 4, 5]]);
  });

  it('parte en tandas del tamaño pedido', () => {
    const tandas = tandasDePlacas(1, 2500, 1000);
    expect(tandas).toHaveLength(3);
    expect(tandas[0]).toHaveLength(1000);
    expect(tandas[1]).toHaveLength(1000);
    expect(tandas[2]).toHaveLength(500);
  });

  it('no pierde ni repite ninguna placa', () => {
    const todas = tandasDePlacas(1, 2300, 1000).flat();
    expect(todas).toHaveLength(2300);
    expect(new Set(todas).size).toBe(2300);
    expect(todas[0]).toBe(1);
    expect(todas[todas.length - 1]).toBe(2300);
  });

  it('arranca donde se le diga, no siempre en 1', () => {
    // Caso real: el lote ya tiene 211 árboles y se sube el total a 1.800.
    const tandas = tandasDePlacas(212, 1800, 1000);
    expect(tandas.flat()[0]).toBe(212);
    expect(tandas.flat()).toHaveLength(1589);
  });

  it('devuelve vacío cuando no hay nada que crear', () => {
    expect(tandasDePlacas(10, 9, 1000)).toEqual([]);
    expect(tandasDePlacas(10, 10, 1000)).toEqual([[10]]);
  });

  it('usa un tamaño de tanda por defecto razonable', () => {
    expect(TAMANO_TANDA_ARBOLES).toBeGreaterThan(0);
    expect(TAMANO_TANDA_ARBOLES).toBeLessThanOrEqual(2000);
  });
});
