'use client';

import { useEffect } from 'react';
import { recordarUsuarioLocal } from '@/lib/offline/sesion';

export const CLAVE_ROL = 'zelanda_rol_ultimo';

/**
 * Ata este celular a la sesión que está abierta.
 *
 * Hace dos cosas, las dos necesarias para que no se mezclen cuentas:
 *  - guarda el rol en localStorage, que es lo único que el service worker puede
 *    leer desde su HTML de arranque para saber a qué home mandar sin señal;
 *  - le avisa al service worker quién entró, para que borre las páginas
 *    cacheadas de la cuenta anterior. Ese HTML viene ya autenticado: servírselo
 *    a otra persona es mostrarle la sesión ajena.
 */
export function SesionLocal({ usuarioId, rol }: { usuarioId: string; rol: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_ROL, rol);
    } catch {
      // Storage no disponible (modo privado raro); ignorar.
    }
    recordarUsuarioLocal(usuarioId);

    if (!('serviceWorker' in navigator)) return;
    // `ready` puede no resolver nunca si el worker no llega a activarse; como
    // esto es aviso y no bloquea nada, se deja sin await y sin timeout.
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ tipo: 'sesion', usuarioId }))
      .catch(() => undefined);
  }, [usuarioId, rol]);

  return null;
}
