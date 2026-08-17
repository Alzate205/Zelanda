'use client';

import { useEffect } from 'react';

const CLAVE_ULTIMA = 'zelanda_precarga_ultima';
/** Estas pantallas cambian poco y el celular suele estar con datos móviles. */
const CADA_MS = 10 * 60 * 1000;

function tocaPrecargar(clave: string): boolean {
  try {
    const guardado = localStorage.getItem(CLAVE_ULTIMA);
    if (guardado) {
      const { c, t } = JSON.parse(guardado) as { c: string; t: number };
      if (c === clave && Date.now() - t < CADA_MS) return false;
    }
    localStorage.setItem(CLAVE_ULTIMA, JSON.stringify({ c: clave, t: Date.now() }));
  } catch {
    // Sin storage no hay con qué acordarse: se precarga siempre.
  }
  return true;
}

/**
 * Deja guardadas, mientras hay internet, las pantallas que harán falta sin él.
 *
 * La lista de tareas ya funciona sin señal porque vive en IndexedDB, pero
 * abrirlas no: esas páginas las arma el servidor. Sin esto, el trabajador veía
 * sus tareas en el monte y no podía entrar a ninguna a registrar.
 *
 * El prefetch de Next no alcanza: manda payloads parciales que el service
 * worker descarta a propósito. Por eso se le pide al worker que baje y guarde
 * la versión completa de cada pantalla.
 */
export function PrecargarOffline({ urls }: { urls: string[] }) {
  const clave = urls.join('|');

  useEffect(() => {
    const lista = clave ? clave.split('|') : [];
    if (lista.length === 0) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!navigator.onLine) return;
    if (!tocaPrecargar(clave)) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ tipo: 'precargar', urls: lista }))
      .catch(() => undefined);
  }, [clave]);

  return null;
}
