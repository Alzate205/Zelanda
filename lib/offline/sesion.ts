/**
 * Quién es el dueño de lo que hay guardado en este celular.
 *
 * La cola offline vive en el navegador, no en la cuenta: si un trabajador deja
 * un registro pendiente, cierra sesión y en el mismo celular entra otra
 * persona, al volver la señal ese registro se subía con las cookies del
 * segundo — y el servidor se lo atribuía a él. Marcando cada item con el
 * usuario que lo creó, la sincronización solo sube lo propio y lo ajeno espera
 * a que su dueño vuelva a entrar.
 */

const CLAVE_USUARIO = 'zelanda_usuario_ultimo';

export function recordarUsuarioLocal(id: string): void {
  try {
    localStorage.setItem(CLAVE_USUARIO, id);
  } catch {
    // Storage no disponible; la cola queda sin dueño y se comporta como antes.
  }
}

export function usuarioLocal(): string | null {
  try {
    return localStorage.getItem(CLAVE_USUARIO);
  } catch {
    return null;
  }
}

/**
 * ¿Le toca a esta sesión subir un item de la cola?
 *
 * Los items sin dueño son de antes de este cambio, y si no sabemos quién está
 * adentro no hay con qué comparar: en los dos casos se sube, porque dejar
 * trabajo varado para siempre es peor que el riesgo que esto corrige.
 */
export function esDeLaSesion(
  usuarioItem: string | null | undefined,
  usuarioActual: string | null
): boolean {
  if (!usuarioItem) return true;
  if (!usuarioActual) return true;
  return usuarioItem === usuarioActual;
}
