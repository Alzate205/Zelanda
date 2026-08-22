'use client';

import { useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  guardarSnapshotBodega,
  guardarSnapshotAlmacen,
  tsBodega,
  tsAlmacen,
} from '@/lib/offline/cache';
import type { SnapshotBodega, SnapshotAlmacen } from '@/lib/offline/tipos';

/**
 * Deja guardados en el celular los datos del rol mientras hay señal.
 *
 * Las rutas `/api/bodega/snapshot` y `/api/almacen/snapshot` existían desde
 * hace tiempo, junto con sus tipos, sus tablas de IndexedDB y su estrategia de
 * caché en el service worker — y nadie las llamaba. Bodega y almacén eran los
 * dos únicos roles sin datos sin señal, en una finca donde no hay cobertura.
 * Esto es la pieza que faltaba para cerrar esa cadena.
 *
 * No pinta nada: solo mantiene la caché fresca.
 */

/** Cada cuánto vale la pena volver a bajarlo. Los datos de bodega cambian poco. */
const FRESCURA_MS = 5 * 60 * 1000;

type Rol = 'bodega' | 'almacen';

async function edadCache(rol: Rol): Promise<number | null> {
  const ts = rol === 'bodega' ? await tsBodega() : await tsAlmacen();
  return ts === null ? null : Date.now() - ts;
}

export function SincronizarSnapshot({ rol }: { rol: Rol }) {
  const online = useOnlineStatus();

  useEffect(() => {
    if (!online) return;
    let cancelado = false;

    async function traer() {
      try {
        const edad = await edadCache(rol);
        if (edad !== null && edad < FRESCURA_MS) return;

        const res = await fetch(`/api/${rol}/snapshot`);
        if (!res.ok || cancelado) return;

        if (rol === 'bodega') {
          await guardarSnapshotBodega((await res.json()) as SnapshotBodega);
        } else {
          await guardarSnapshotAlmacen((await res.json()) as SnapshotAlmacen);
        }
      } catch {
        // Sin señal o error pasajero: se reintenta la próxima vez que se abra.
      }
    }

    traer();
    return () => {
      cancelado = true;
    };
  }, [online, rol]);

  return null;
}
