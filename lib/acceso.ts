/**
 * Reglas de acceso: nombre de usuario y clave.
 *
 * En la finca casi nadie tiene correo, así que el jefe crea el acceso con un
 * nombre de usuario y ya. Supabase Auth siempre necesita un email, así que se
 * arma uno interno (`pedro@zelanda.local`) que el trabajador nunca ve ni
 * escribe: él entra con `pedro`. `usuarios.username` guarda el nombre real y
 * el login lo resuelve al correo interno.
 *
 * La clave admite 4 caracteres para que pueda ser un PIN numérico. Es una
 * decisión consciente del dueño: con guantes y sin costumbre de teclear, una
 * clave larga termina escrita en un papel pegado a la pared, que es peor.
 */

/** Mínimo de la clave. Cuatro permite un PIN de cuatro números. */
export const MIN_CLAVE = 4;

/** Dominio de los correos internos. Nunca sale a la vista del usuario. */
export const DOMINIO_INTERNO = 'zelanda.local';

const MIN_USERNAME = 3;

export type Resultado<T> = { ok: true } & T;
export type Fallo = { ok: false; error: string };

function sinTildes(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Minúsculas, sin tildes, y los espacios de en medio pasan a puntos. */
export function normalizarUsername(raw: string): string {
  return sinTildes(
    String(raw ?? '')
      .trim()
      .toLowerCase()
  ).replace(/\s+/g, '.');
}

export function validarUsername(raw: string): Resultado<{ username: string }> | Fallo {
  const username = normalizarUsername(raw);
  if (!username) {
    return { ok: false, error: 'El nombre de usuario es obligatorio.' };
  }
  if (username.includes('@')) {
    return {
      ok: false,
      error: 'Escribe solo el nombre de usuario, sin correo. Por ejemplo: pedro',
    };
  }
  if (username.length < MIN_USERNAME) {
    return {
      ok: false,
      error: `El nombre de usuario debe tener al menos ${MIN_USERNAME} letras.`,
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) {
    return {
      ok: false,
      error: 'Usa solo letras, números, puntos o guiones. Por ejemplo: juan.carlos',
    };
  }
  return { ok: true, username };
}

export function emailDesdeUsername(username: string): string {
  return `${username}@${DOMINIO_INTERNO}`;
}

/** Propone el primer nombre como usuario. El jefe lo puede cambiar. */
export function sugerirUsername(nombreCompleto: string): string {
  const primero = String(nombreCompleto ?? '')
    .trim()
    .split(/\s+/)[0];
  if (!primero) return '';
  return sinTildes(primero.toLowerCase()).replace(/[^a-z0-9._-]/g, '');
}

export function validarClave(clave: string, confirmacion?: string): Resultado<object> | Fallo {
  const c = String(clave ?? '');
  if (c.length < MIN_CLAVE) {
    return {
      ok: false,
      error: `La clave debe tener al menos ${MIN_CLAVE} caracteres. Pueden ser 4 números.`,
    };
  }
  if (confirmacion !== undefined && c !== confirmacion) {
    return { ok: false, error: 'Las claves no coinciden.' };
  }
  return { ok: true };
}
