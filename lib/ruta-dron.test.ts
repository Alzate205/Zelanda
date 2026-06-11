import { describe, it, expect } from 'vitest';
import { ordenarPorCercania } from './ruta-dron';

describe('ordenarPorCercania', () => {
  it('ordena por vecino más cercano partiendo del primero', () => {
    // a en 0, c en 1, b en 5 (sobre una línea): desde a lo más cercano es c
    const ruta = ordenarPorCercania([
      { id: 'a', centro: [0, 0] },
      { id: 'b', centro: [5, 0] },
      { id: 'c', centro: [1, 0] },
    ]);
    expect(ruta).toEqual(['a', 'c', 'b']);
  });

  it('lista vacía devuelve vacío', () => {
    expect(ordenarPorCercania([])).toEqual([]);
  });

  it('un solo lote devuelve ese lote', () => {
    expect(ordenarPorCercania([{ id: 'x', centro: [1, 1] }])).toEqual(['x']);
  });
});
