import { describe, it, expect } from 'vitest';
import {
  validarUsername,
  validarClave,
  emailDesdeUsername,
  sugerirUsername,
  MIN_CLAVE,
  DOMINIO_INTERNO,
} from './acceso';

describe('validarUsername', () => {
  it('acepta un nombre simple', () => {
    const r = validarUsername('pedro');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.username).toBe('pedro');
  });

  it('normaliza mayúsculas, tildes y espacios sobrantes', () => {
    const r = validarUsername('  Pedró  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.username).toBe('pedro');
  });

  it('convierte los espacios de en medio en puntos', () => {
    // "juan carlos" es lo que el jefe escribe; un espacio no sirve para entrar.
    const r = validarUsername('Juan Carlos');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.username).toBe('juan.carlos');
  });

  it('acepta números, puntos y guiones', () => {
    expect(validarUsername('pedro.r-2').ok).toBe(true);
  });

  it('rechaza el vacío y lo demasiado corto', () => {
    expect(validarUsername('').ok).toBe(false);
    expect(validarUsername('ab').ok).toBe(false);
  });

  it('rechaza un correo: acá va un usuario, no un email', () => {
    expect(validarUsername('pedro@gmail.com').ok).toBe(false);
  });

  it('rechaza caracteres que romperían el correo interno', () => {
    expect(validarUsername('pedro/ramirez').ok).toBe(false);
    expect(validarUsername('pedro ñ!').ok).toBe(false);
  });
});

describe('emailDesdeUsername', () => {
  it('arma el correo interno que nunca ve el usuario', () => {
    expect(emailDesdeUsername('pedro')).toBe(`pedro@${DOMINIO_INTERNO}`);
  });
});

describe('sugerirUsername', () => {
  it('propone el primer nombre en minúsculas y sin tildes', () => {
    expect(sugerirUsername('Pedro Ramírez Gómez')).toBe('pedro');
    expect(sugerirUsername('  María  Restrepo ')).toBe('maria');
  });

  it('devuelve vacío si no hay de dónde sacarlo', () => {
    expect(sugerirUsername('')).toBe('');
  });
});

describe('validarClave', () => {
  it(`acepta ${MIN_CLAVE} caracteres`, () => {
    expect(validarClave('1234').ok).toBe(true);
  });

  it('acepta claves largas y con símbolos', () => {
    expect(validarClave('Una-Clave-Larga-99').ok).toBe(true);
  });

  it('rechaza menos del mínimo', () => {
    expect(validarClave('123').ok).toBe(false);
    expect(validarClave('').ok).toBe(false);
  });

  it('exige que la confirmación coincida cuando se pasa', () => {
    expect(validarClave('1234', '1234').ok).toBe(true);
    const r = validarClave('1234', '5678');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no coinciden/i);
  });
});
