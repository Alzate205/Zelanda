"use client";

import { useEffect, useState } from "react";
import { suscribirseACambios } from "@/lib/offline/eventos";
import { contarVisibles, contarErrores } from "@/lib/offline/cola";

export function useColaPendientes(): { total: number; errores: number } {
  const [total, setTotal] = useState(0);
  const [errores, setErrores] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function refrescar() {
      const [t, e] = await Promise.all([contarVisibles(), contarErrores()]);
      if (!cancelado) {
        setTotal(t);
        setErrores(e);
      }
    }
    refrescar();
    const desuscribir = suscribirseACambios(refrescar);
    return () => {
      cancelado = true;
      desuscribir();
    };
  }, []);

  return { total, errores };
}
