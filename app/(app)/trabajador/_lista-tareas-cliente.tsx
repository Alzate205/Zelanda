'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronRight,
  Hexagon,
  Leaf,
  Droplets,
  Scissors,
  Sprout,
  Bug,
  Apple,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PrecargarOffline } from '@/components/shared/PrecargarOffline';
import { leerAsignaciones, guardarSnapshotTrabajador, cacheFresca } from '@/lib/offline/cache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { AsignacionCacheada, SnapshotTrabajador } from '@/lib/offline/tipos';

function iconoTarea(nombre: string, area: string): LucideIcon {
  const n = nombre.toLowerCase();
  if (area === 'apicultura') return Hexagon;
  if (n.includes('rieg')) return Droplets;
  if (n.includes('poda')) return Scissors;
  if (n.includes('fert')) return Sprout;
  if (n.includes('plag')) return Bug;
  if (n.includes('cosech')) return Apple;
  return Leaf;
}

const botonNovedad =
  'flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-zelanda-ocre-600 px-4 text-lg font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-ocre-700 [box-shadow:0_3px_0_theme(colors.zelanda.ocre.700),0_1px_3px_rgba(20,44,26,0.06)]';

export function ListaTareasCliente({
  nombrePila,
  snapshotInicial,
}: {
  nombrePila: string;
  snapshotInicial: SnapshotTrabajador | null;
}) {
  const online = useOnlineStatus();
  const [asignaciones, setAsignaciones] = useState<AsignacionCacheada[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      if (snapshotInicial) {
        await guardarSnapshotTrabajador(snapshotInicial);
      }
      const locales = await leerAsignaciones();
      if (!cancelado) {
        setAsignaciones(locales);
        setCargando(false);
      }
      if (online && !(await cacheFresca())) {
        try {
          const res = await fetch('/api/trabajador/snapshot');
          if (res.ok) {
            const snap = (await res.json()) as SnapshotTrabajador;
            await guardarSnapshotTrabajador(snap);
            if (!cancelado) setAsignaciones(await leerAsignaciones());
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

  const titulo = (
    <h1 className="font-serif text-3xl text-zelanda-verde-900">{nombrePila}, tus tareas</h1>
  );

  // Las pantallas donde el trabajador realmente registra: se guardan ahora,
  // con señal, porque en el monte no habrá con qué traerlas.
  const paraOffline = (
    <PrecargarOffline
      urls={[
        '/trabajador/novedad/nueva',
        '/trabajador/pendientes',
        ...asignaciones.map((a) => `/trabajador/avance/${a.id}`),
      ]}
    />
  );

  if (cargando) {
    return (
      <div className="space-y-5 pb-28">
        {titulo}
        <p className="rounded-2xl border-2 border-dashed border-zelanda-beige-300 bg-white px-6 py-12 text-center text-lg text-zelanda-verde-700">
          Cargando…
        </p>
      </div>
    );
  }

  if (asignaciones.length === 0) {
    return (
      <div className="space-y-5 pb-28">
        {titulo}
        {paraOffline}
        <EmptyState
          titulo="Hoy no tienes tareas"
          descripcion="Cuando el jefe te asigne una, aparece aquí."
        />
        <BarraNovedad />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {titulo}
      {paraOffline}

      <div className="flex flex-col gap-3.5">
        {asignaciones.map((a) => {
          const Icono = iconoTarea(a.tipo_tarea_nombre, a.tipo_tarea_area ?? 'cultivo');
          const destino = a.lote_id ? a.lote_nombre : a.apiario_nombre ?? 'Apiario';
          const detalle = a.lote_id
            ? `Llevas ${a.arboles_completados.toLocaleString('es-CO')} de ${(
                a.total_arboles ?? 0
              ).toLocaleString('es-CO')} árboles`
            : `${a.total_colmenas ?? 0} colmenas`;
          return (
            <Link
              key={a.id}
              href={`/trabajador/avance/${a.id}`}
              className="flex min-h-[92px] items-center gap-4 rounded-2xl border-2 border-zelanda-beige-200 bg-white px-4 py-4 shadow-card transition hover:border-zelanda-verde-300"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zelanda-verde-50 text-zelanda-verde-700">
                <Icono className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-serif text-xl leading-tight text-zelanda-verde-900">
                  {a.tipo_tarea_nombre}
                </p>
                <p className="m-0 mt-1 text-base text-zelanda-verde-800">{destino}</p>
                <p className="m-0 mt-0.5 text-sm text-zelanda-verde-700">{detalle}</p>
              </div>
              <ChevronRight className="h-7 w-7 shrink-0 text-zelanda-verde-700/50" />
            </Link>
          );
        })}
      </div>

      <BarraNovedad />
    </div>
  );
}

function BarraNovedad() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 mx-auto max-w-screen-md bg-gradient-to-t from-zelanda-beige-50 via-zelanda-beige-50 px-4 pb-3 pt-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <Link href="/trabajador/novedad/nueva" className={botonNovedad}>
        <Plus className="h-6 w-6" />
        Reportar novedad
      </Link>
    </div>
  );
}
