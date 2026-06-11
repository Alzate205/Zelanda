'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { guardarSnapshotJefe, leerSnapshotJefe, tsJefe } from '@/lib/offline/cache';
import type { SnapshotJefe } from '@/lib/offline/tipos';

/**
 * Snapshot del jefe con cache offline (IndexedDB) y refresh en línea.
 * Devuelve el snapshot más fresco disponible y el timestamp del cache.
 */
export function useSnapshotJefe(snapshotInicial: SnapshotJefe): {
  snapshot: SnapshotJefe;
  tsCache: number | null;
} {
  const online = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<SnapshotJefe>(snapshotInicial);
  const [tsCache, setTsCache] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const cacheado = await leerSnapshotJefe();
      if (!cacheado) {
        await guardarSnapshotJefe(snapshotInicial);
        if (!cancelado) {
          setSnapshot(snapshotInicial);
          setTsCache(await tsJefe());
        }
      } else if (!cancelado) {
        setSnapshot(cacheado);
        setTsCache(await tsJefe());
      }

      if (online) {
        try {
          const res = await fetch('/api/jefe/snapshot');
          if (res.ok) {
            const fresco = (await res.json()) as SnapshotJefe;
            await guardarSnapshotJefe(fresco);
            if (!cancelado) {
              setSnapshot(fresco);
              setTsCache(await tsJefe());
            }
          }
        } catch {
          // offline o error transitorio
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [online, snapshotInicial]);

  return { snapshot, tsCache };
}
