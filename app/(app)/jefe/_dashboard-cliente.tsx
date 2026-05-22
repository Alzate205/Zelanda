"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  guardarSnapshotJefe,
  leerSnapshotJefe,
  tsJefe,
} from "@/lib/offline/cache";
import type { SnapshotJefe } from "@/lib/offline/tipos";
import { ETIQUETA_NOVEDAD } from "@/lib/constantes";

function formatearDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 0) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}

function describirActualizacion(ts: number | null): string {
  if (ts === null) return "Sin sincronizar";
  const diffMs = Date.now() - ts;
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "Actualizado hace un momento";
  if (minutos < 60) return `Actualizado hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Actualizado hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Actualizado hace ${dias} d`;
}

export function DashboardJefeCliente({
  nombrePila,
  snapshotInicial,
}: {
  nombrePila: string;
  snapshotInicial: SnapshotJefe;
}) {
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
          const res = await fetch("/api/jefe/snapshot");
          if (res.ok) {
            const fresco = (await res.json()) as SnapshotJefe;
            await guardarSnapshotJefe(fresco);
            if (!cancelado) {
              setSnapshot(fresco);
              setTsCache(await tsJefe());
            }
          }
        } catch {
          // offline o error transitorio: nos quedamos con lo cacheado
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [online, snapshotInicial]);

  const { vencidas, proximas, novedades_pendientes, contadores } = snapshot;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Panel del jefe
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {nombrePila}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <AlertTriangle className="h-4 w-4 text-estado-vencida" />
          Vencidas <span className="text-sm font-normal text-zelanda-verde-700">({vencidas.length})</span>
        </h2>
        {vencidas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Todo al día por ahora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {vencidas.map((f) => (
              <li key={`${f.lote_id}_${f.tipo_id}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.lote_id}&tipo_tarea_id=${f.tipo_id}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipo_nombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.lote_nombre}</span>
                  </span>
                  <span className="text-xs text-estado-vencida">
                    {f.estado === "sin_historial" ? "nunca hecho" : `vencida ${formatearDias(f.dias_para_proxima)}`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Clock className="h-4 w-4 text-estado-proxima" />
          Próximas (7 días) <span className="text-sm font-normal text-zelanda-verde-700">({proximas.length})</span>
        </h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin tareas próximas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximas.map((f) => (
              <li key={`${f.lote_id}_${f.tipo_id}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.lote_id}&tipo_tarea_id=${f.tipo_id}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipo_nombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.lote_nombre}</span>
                  </span>
                  <span className="text-xs text-estado-proxima">{formatearDias(f.dias_para_proxima)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <AlertCircle className="h-4 w-4 text-zelanda-ocre-600" />
            Novedades sin resolver
          </h2>
          <Link href="/jefe/novedades" className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900">
            Ver todas
          </Link>
        </div>
        {novedades_pendientes.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin novedades pendientes.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedades_pendientes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo}</BadgeBase>
                  <span className="flex-1 truncate text-zelanda-verde-900">
                    Árbol {n.arbol_numero} · Lote {n.lote_nombre}
                  </span>
                  <span className="text-xs text-zelanda-verde-700">{formatearFechaCorta(n.fecha)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Operación
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/jefe/inventario"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Stock bajo
            </p>
            <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
              {contadores.stock_bajo}
            </p>
          </Link>
          <Link
            href="/bodega/despachos"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Despachos abiertos
            </p>
            <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
              {contadores.despachos_abiertos}
            </p>
          </Link>
          <Link
            href="/jefe/almacen-vista"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Almacén
            </p>
            <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
              {contadores.stock_almacen_kg.toLocaleString("es-CO", {
                maximumFractionDigits: 0,
              })}{" "}
              kg
            </p>
          </Link>
          <Link
            href="/jefe/instalaciones"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Mapa
            </p>
            <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
              Capturar
            </p>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Configuración
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/jefe/tareas"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Tipos de tarea
            </p>
            <p className="mt-1 font-serif text-base text-zelanda-verde-900">
              Frecuencias y catálogo
            </p>
          </Link>
          <Link
            href="/jefe/reportes"
            className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Reportes
            </p>
            <p className="mt-1 font-serif text-base text-zelanda-verde-900">
              Cosecha, lotes, recolectores
            </p>
          </Link>
        </div>
      </section>

      <p className="pt-2 text-center text-[11px] text-zelanda-verde-700/70">
        {describirActualizacion(tsCache)}
      </p>
    </div>
  );
}
