"use client";

import { useEffect } from "react";

/**
 * Guarda el rol del usuario en localStorage para que el service worker
 * pueda decidir a qué home redirigir cuando se abre la PWA offline.
 */
export function GuardarRolLocal({ rol }: { rol: string }) {
  useEffect(() => {
    try {
      localStorage.setItem("zelanda_rol_ultimo", rol);
    } catch {
      // Storage no disponible (modo privado raro); ignorar.
    }
  }, [rol]);
  return null;
}
