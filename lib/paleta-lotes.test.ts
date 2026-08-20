import { describe, it, expect } from 'vitest';
import { asignarColoresLotes, COLORES_DISPONIBLES } from './paleta-lotes';

describe('la paleta', () => {
  it('no tiene colores repetidos', () => {
    // Un duplicado acá haría que dos lotes salgan del mismo color sin que el
    // reparto se haya agotado, que es justo lo que esto evita.
    const ids = Array.from({ length: COLORES_DISPONIBLES }, (_, i) => String(i + 1));
    const colores = [...asignarColoresLotes(ids).values()];
    expect(new Set(colores).size).toBe(COLORES_DISPONIBLES);
  });

  it('alcanza para los lotes que tiene la finca', () => {
    // La finca tiene 16 lotes. Si crece por encima de la paleta, hay que sumar
    // colores: este test avisa antes de que se vea en el mapa.
    expect(COLORES_DISPONIBLES).toBeGreaterThanOrEqual(16);
  });
});

describe('asignarColoresLotes', () => {
  it('no repite colores mientras alcance la paleta', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const colores = asignarColoresLotes(ids);
    expect(new Set(colores.values()).size).toBe(ids.length);
  });

  it('mantiene el color de los lotes que ya estaban al agregar uno nuevo', () => {
    // Si el mapa te cambiara los colores cada vez que registrás un lote, dejaría
    // de servir para reconocerlos de un vistazo.
    const antes = asignarColoresLotes(['1', '2', '3']);
    const despues = asignarColoresLotes(['1', '2', '3', '4']);
    for (const id of ['1', '2', '3']) {
      expect(despues.get(id)).toBe(antes.get(id));
    }
  });

  it('reparte igual sin importar en qué orden lleguen los ids', () => {
    const a = asignarColoresLotes(['3', '1', '2']);
    const b = asignarColoresLotes(['1', '2', '3']);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('vuelve a empezar la paleta cuando hay más lotes que colores', () => {
    const ids = Array.from({ length: COLORES_DISPONIBLES + 1 }, (_, i) => String(i + 1));
    const colores = asignarColoresLotes(ids);
    expect(colores.get(ids[0])).toBe(colores.get(ids[COLORES_DISPONIBLES]));
  });
});
