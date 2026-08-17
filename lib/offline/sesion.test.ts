import { describe, it, expect } from 'vitest';
import { esDeLaSesion } from './sesion';

describe('esDeLaSesion', () => {
  it('sube lo que encoló la sesión que está adentro', () => {
    expect(esDeLaSesion('usuario-a', 'usuario-a')).toBe(true);
  });

  it('NO sube lo que encoló otra persona en el mismo celular', () => {
    // El caso real: el trabajador deja un avance pendiente, cierra sesión y
    // entra bodega. Ese avance no puede subirse con las cookies de bodega.
    expect(esDeLaSesion('usuario-a', 'usuario-b')).toBe(false);
  });

  it('sube los items viejos, que no tienen dueño guardado', () => {
    expect(esDeLaSesion(null, 'usuario-a')).toBe(true);
    expect(esDeLaSesion(undefined, 'usuario-a')).toBe(true);
  });

  it('sube si no sabemos quién está adentro', () => {
    expect(esDeLaSesion('usuario-a', null)).toBe(true);
  });
});
