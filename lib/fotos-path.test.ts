import { describe, it, expect } from 'vitest';
import { pathFotoValido } from './fotos-path';

describe('pathFotoValido', () => {
  it('acepta el path que produce la ruta de subida', () => {
    expect(pathFotoValido('novedades/1712345678_foto.jpg', 'novedades')).toBe(
      'novedades/1712345678_foto.jpg'
    );
    expect(pathFotoValido('avance/1712345678_foto.jpg', 'avance')).toBe(
      'avance/1712345678_foto.jpg'
    );
  });

  it('rechaza la carpeta que no corresponde', () => {
    expect(pathFotoValido('avance/x.jpg', 'novedades')).toBeNull();
    expect(pathFotoValido('novedades/x.jpg', 'avance')).toBeNull();
  });

  it('rechaza subcarpetas y saltos hacia arriba', () => {
    expect(pathFotoValido('novedades/../privado/x.jpg', 'novedades')).toBeNull();
    expect(pathFotoValido('novedades/otra/x.jpg', 'novedades')).toBeNull();
  });

  it('rechaza lo que no es texto, lo vacío y lo desmedido', () => {
    expect(pathFotoValido(null, 'avance')).toBeNull();
    expect(pathFotoValido(42, 'avance')).toBeNull();
    expect(pathFotoValido('', 'avance')).toBeNull();
    expect(pathFotoValido('   ', 'avance')).toBeNull();
    expect(pathFotoValido(`avance/${'a'.repeat(400)}.jpg`, 'avance')).toBeNull();
  });

  it('no se deja engañar por un prefijo parecido', () => {
    expect(pathFotoValido('avances/x.jpg', 'avance')).toBeNull();
    expect(pathFotoValido('novedades2/x.jpg', 'novedades')).toBeNull();
  });
});
