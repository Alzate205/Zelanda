"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  ChevronRight,
  Package,
  ClipboardList,
  BarChart3,
  Warehouse,
} from "lucide-react";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  guardarSnapshotJefe,
  leerSnapshotJefe,
  tsJefe,
} from "@/lib/offline/cache";
import type { SnapshotJefe, AlertaTareaJefe } from "@/lib/offline/tipos";
import { ETIQUETA_NOVEDAD } from "@/lib/constantes";
import { AsignarMasivoBox } from "@/components/jefe/AsignarMasivoBox";
import { KPI } from "@/components/ui/KPI";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Atajo } from "@/components/shared/Atajo";

type Persona = { id: string; nombre: string };

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

type GrupoAlerta = {
  tipo_id: string;
  tipo_nombre: string;
  lotes: AlertaTareaJefe[];
};

function urgenciaEfectiva(lote: AlertaTareaJefe): number {
  if (lote.estado === "sin_historial") return Number.NEGATIVE_INFINITY;
  return lote.dias_para_proxima ?? 0;
}

function agruparPorTipo(alertas: AlertaTareaJefe[]): GrupoAlerta[] {
  const mapa = new Map<string, GrupoAlerta>();
  for (const a of alertas) {
    let g = mapa.get(a.tipo_id);
    if (!g) {
      g = { tipo_id: a.tipo_id, tipo_nombre: a.tipo_nombre, lotes: [] };
      mapa.set(a.tipo_id, g);
    }
    g.lotes.push(a);
  }
  for (const g of mapa.values()) {
    g.lotes.sort((x, y) => urgenciaEfectiva(x) - urgenciaEfectiva(y));
  }
  return [...mapa.values()].sort(
    (a, b) => urgenciaEfectiva(a.lotes[0]) - urgenciaEfectiva(b.lotes[0]),
  );
}

function GrupoTareaItem({
  grupo,
  tono,
  expandido,
  onToggle,
  personas,
}: {
  grupo: GrupoAlerta;
  tono: "vencida" | "proxima";
  expandido: boolean;
  onToggle: () => void;
  personas: Persona[];
}) {
  const colorTexto =
    tono === "vencida" ? "text-estado-vencida" : "text-estado-proxima";
  const masUrgente = grupo.lotes[0];
  const resumenUrgencia =
    masUrgente.estado === "sin_historial"
      ? "nunca hecho"
      : formatearDias(masUrgente.dias_para_proxima);
  const cantidad = grupo.lotes.length;
  const destinoIds = grupo.lotes.map((l) => l.lote_id);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-left text-sm transition hover:bg-zelanda-beige-50"
      >
        <span className="flex-1">
          <span className="block font-medium text-zelanda-verde-900">
            {grupo.tipo_nombre}
          </span>
          <span className={`block text-xs ${colorTexto}`}>
            {cantidad} {cantidad === 1 ? "lote" : "lotes"} · {resumenUrgencia}
          </span>
        </span>
        <ChevronRight
          className={`h-4 w-4 text-zelanda-verde-700/40 transition-transform ${expandido ? "rotate-90" : ""}`}
        />
      </button>
      {expandido && (
        <div className="ml-3 mt-2 space-y-2 border-l border-zelanda-beige-200 pl-3">
          <AsignarMasivoBox
            tipoTareaId={grupo.tipo_id}
            kind="lote"
            destinoIds={destinoIds}
            personas={personas}
          />
          <ul className="space-y-1">
            {grupo.lotes.map((l) => (
              <li key={`${l.lote_id}_${l.tipo_id}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${l.lote_id}&tipo_tarea_id=${l.tipo_id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1 text-zelanda-verde-900">
                    Lote {l.lote_nombre}
                  </span>
                  <span className={`text-xs ${colorTexto}`}>
                    {l.estado === "sin_historial"
                      ? "nunca hecho"
                      : formatearDias(l.dias_para_proxima)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
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
  const [expandidasVencidas, setExpandidasVencidas] = useState<Set<string>>(
    new Set(),
  );
  const [expandidasProximas, setExpandidasProximas] = useState<Set<string>>(
    new Set(),
  );

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

  const { vencidas, proximas, novedades_pendientes, contadores, personas } =
    snapshot;
  const gruposVencidas = agruparPorTipo(vencidas);
  const gruposProximas = agruparPorTipo(proximas);

  const alternarVencida = (id: string) =>
    setExpandidasVencidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  const alternarProxima = (id: string) =>
    setExpandidasProximas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

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
            {gruposVencidas.map((g) => (
              <GrupoTareaItem
                key={g.tipo_id}
                grupo={g}
                tono="vencida"
                expandido={expandidasVencidas.has(g.tipo_id)}
                onToggle={() => alternarVencida(g.tipo_id)}
                personas={personas}
              />
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
            {gruposProximas.map((g) => (
              <GrupoTareaItem
                key={g.tipo_id}
                grupo={g}
                tono="proxima"
                expandido={expandidasProximas.has(g.tipo_id)}
                onToggle={() => alternarProxima(g.tipo_id)}
                personas={personas}
              />
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
        <Eyebrow>Operación</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <KPI
            href="/jefe/inventario"
            etiqueta="Stock bajo"
            valor={contadores.stock_bajo}
            pie="Insumos en alerta"
            acento={contadores.stock_bajo > 0 ? "ocre" : "verde"}
          />
          <KPI
            href="/bodega/despachos"
            etiqueta="Despachos"
            valor={contadores.despachos_abiertos}
            pie="Abiertos hoy"
          />
          <KPI
            href="/jefe/almacen-vista"
            etiqueta="Almacén"
            valor={`${contadores.stock_almacen_kg.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg`}
            pie="Stock cosecha"
          />
          <KPI
            href="/jefe/instalaciones"
            etiqueta="Mapa"
            valor="+"
            pie="Capturar polígonos"
          />
        </div>
      </section>

      <section className="space-y-3">
        <Eyebrow>Más secciones</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <Atajo
            href="/jefe/tareas"
            icono={ClipboardList}
            titulo="Tipos de tarea"
            sub="Frecuencias y catálogo"
          />
          <Atajo
            href="/jefe/reportes"
            icono={BarChart3}
            titulo="Reportes"
            sub="Cosecha, lotes, recolectores"
          />
          <Atajo
            href="/jefe/inventario"
            icono={Package}
            titulo="Inventario"
            sub="Insumos y herramientas"
          />
          <Atajo
            href="/jefe/almacen-vista"
            icono={Warehouse}
            titulo="Almacén"
            sub="Cosecha y salidas"
          />
        </div>
      </section>

      <p className="pt-2 text-center text-[11px] text-zelanda-verde-700/70">
        {describirActualizacion(tsCache)}
      </p>
    </div>
  );
}
