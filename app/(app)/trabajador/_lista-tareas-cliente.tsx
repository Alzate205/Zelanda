"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Bar } from "@/components/ui/Bar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  leerAsignaciones,
  guardarSnapshotTrabajador,
  cacheFresca,
} from "@/lib/offline/cache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type {
  AsignacionCacheada,
  SnapshotTrabajador,
} from "@/lib/offline/tipos";

function iconoTarea(nombre: string, area: string): LucideIcon {
  const n = nombre.toLowerCase();
  if (area === "apicultura") return Hexagon;
  if (n.includes("rieg")) return Droplets;
  if (n.includes("poda")) return Scissors;
  if (n.includes("fert")) return Sprout;
  if (n.includes("plag")) return Bug;
  if (n.includes("cosech")) return Apple;
  return Leaf;
}

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
          const res = await fetch("/api/trabajador/snapshot");
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

  if (cargando) {
    return (
      <div className="space-y-5 pb-24">
        <header>
          <Eyebrow>Mi día</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Buen día, {nombrePila}
          </h1>
        </header>
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          Cargando…
        </p>
      </div>
    );
  }

  if (asignaciones.length === 0) {
    return (
      <div className="space-y-5 pb-24">
        <header>
          <Eyebrow>Mi día</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Buen día, {nombrePila}
          </h1>
        </header>
        <EmptyState
          titulo="Hoy puedes descansar"
          descripcion="No tienes asignaciones para hoy. Si surge una tarea, te avisaremos."
          acciones={
            <Link
              href="/trabajador/novedad/nueva"
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-ocre-600 px-4 font-semibold text-zelanda-beige-50 shadow-card transition hover:bg-zelanda-ocre-700"
            >
              <Plus className="h-[18px] w-[18px]" />
              Reportar novedad
            </Link>
          }
        />
      </div>
    );
  }

  const enCurso = asignaciones.find((a) => a.estado === "EN_CURSO");
  const otras = asignaciones.filter((a) => a.id !== enCurso?.id);
  const tareaActual = enCurso ?? asignaciones[0];
  const siguientes = enCurso ? otras : asignaciones.slice(1);

  return (
    <div className="space-y-5 pb-24">
      <header>
        <Eyebrow>Mi día</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Buen día, {nombrePila}
        </h1>
        <p className="mt-0.5 text-sm text-zelanda-verde-700">
          {asignaciones.length}{" "}
          {asignaciones.length === 1 ? "tarea asignada" : "tareas asignadas"}
        </p>
      </header>

      {tareaActual ? (
        <article className="overflow-hidden rounded-2xl border border-zelanda-verde-300 bg-white shadow-card">
          <div className="bg-gradient-to-br from-zelanda-verde-700 to-zelanda-verde-800 px-3.5 py-3 text-zelanda-beige-50">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              {tareaActual.estado === "EN_CURSO"
                ? "Tarea en curso"
                : "Siguiente tarea"}
            </p>
            <h2 className="m-0 mt-1 font-serif text-[22px] font-medium">
              {tareaActual.tipo_tarea_nombre} ·{" "}
              {tareaActual.lote_id
                ? tareaActual.lote_nombre
                : (tareaActual.apiario_nombre ?? "Apiario")}
            </h2>
            <p className="m-0 mt-1 text-[12.5px] text-zelanda-beige-100/85">
              {tareaActual.lote_id
                ? `${(tareaActual.total_arboles ?? 0).toLocaleString("es-CO")} árboles`
                : `${tareaActual.total_colmenas ?? 0} colmenas`}
            </p>
          </div>
          <div className="px-3.5 py-3">
            {tareaActual.lote_id ? (
              <>
                <div className="flex justify-between text-xs text-zelanda-verde-700">
                  <span>Tu avance</span>
                  <span>
                    <strong className="font-serif text-zelanda-verde-900">
                      {tareaActual.arboles_completados.toLocaleString("es-CO")}
                    </strong>{" "}
                    / {(tareaActual.total_arboles ?? 0).toLocaleString("es-CO")}{" "}
                    árboles
                  </span>
                </div>
                <Bar
                  valor={
                    (tareaActual.total_arboles ?? 0) > 0
                      ? tareaActual.arboles_completados /
                        (tareaActual.total_arboles ?? 1)
                      : 0
                  }
                  estado="aldia"
                  className="mt-2"
                />
              </>
            ) : null}
            <Link
              href={`/trabajador/avance/${tareaActual.id}`}
              className="mt-3 flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              <Plus className="h-[18px] w-[18px] " />
              {tareaActual.estado === "EN_CURSO"
                ? "Registrar avance"
                : "Empezar tarea"}
            </Link>
          </div>
        </article>
      ) : null}

      {siguientes.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Siguientes
          </h2>
          <div className="flex flex-col gap-2.5">
            {siguientes.map((a) => {
              const Icono = iconoTarea(
                a.tipo_tarea_nombre,
                a.tipo_tarea_area ?? "cultivo",
              );
              const destino = a.lote_id
                ? a.lote_nombre
                : (a.apiario_nombre ?? "Apiario");
              const detalle = a.lote_id
                ? `${(a.total_arboles ?? 0).toLocaleString("es-CO")} árboles`
                : `${a.total_colmenas ?? 0} colmenas`;
              return (
                <Link
                  key={a.id}
                  href={`/trabajador/avance/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white px-3 py-3 shadow-suave transition hover:border-zelanda-verde-300"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-zelanda-verde-50 text-zelanda-verde-700">
                    <Icono className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                      {a.tipo_tarea_nombre} · {destino}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                      {detalle}
                    </p>
                  </div>
                  <Badge estado="neutro">Programada</Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-screen-md px-4 pb-2">
        <Link
          href="/trabajador/novedad/nueva"
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-ocre-600 px-4 font-semibold text-zelanda-beige-50 shadow-card transition hover:bg-zelanda-ocre-700 [box-shadow:0_2px_0_theme(colors.zelanda.ocre.700),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-5 w-5" />
          Reportar novedad
        </Link>
      </div>
    </div>
  );
}
