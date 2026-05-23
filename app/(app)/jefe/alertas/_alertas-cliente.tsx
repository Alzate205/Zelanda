"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  PackageOpen,
  AlertCircle,
  Hexagon,
  ChevronRight,
  Search,
} from "lucide-react";
import { BadgeBase } from "@/components/shared/BadgeRol";

export type Severidad = "critica" | "importante" | "informativa";

export type IconoAlertaTipo =
  | "task"
  | "stock"
  | "novedad"
  | "despacho"
  | "apiario";

export type Alerta = {
  id: string;
  severidad: Severidad;
  icono: IconoAlertaTipo;
  titulo: string;
  detalle: string;
  url: string;
};

type FiltroTipo = "TODOS" | IconoAlertaTipo;

const ORDEN_FILTRO: FiltroTipo[] = [
  "TODOS",
  "task",
  "novedad",
  "stock",
  "despacho",
  "apiario",
];

const ETIQUETAS_FILTRO: Record<FiltroTipo, string> = {
  TODOS: "Todas",
  task: "Tareas",
  novedad: "Novedades",
  stock: "Stock",
  despacho: "Despachos",
  apiario: "Apiarios",
};

function tonoSeveridad(s: Severidad): "alerta" | "neutro" | "info" {
  if (s === "critica") return "alerta";
  if (s === "importante") return "neutro";
  return "info";
}

function IconoAlerta({ tipo }: { tipo: IconoAlertaTipo }) {
  const clase = "h-4 w-4 shrink-0";
  switch (tipo) {
    case "task":
      return <Clock className={`${clase} text-estado-vencida`} />;
    case "stock":
      return <PackageOpen className={`${clase} text-estado-vencida`} />;
    case "novedad":
      return <AlertCircle className={`${clase} text-zelanda-ocre-600`} />;
    case "despacho":
      return <PackageOpen className={`${clase} text-zelanda-ocre-600`} />;
    case "apiario":
      return <Hexagon className={`${clase} text-zelanda-ocre-600`} />;
  }
}

function BloqueAlertas({
  titulo,
  descripcion,
  icono,
  items,
}: {
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  items: Alerta[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        {icono}
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          {titulo}
          <span className="ml-2 text-sm font-normal text-zelanda-verde-700">
            ({items.length})
          </span>
        </h2>
      </div>
      <p className="text-xs text-zelanda-verde-700">{descripcion}</p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={a.url}
              className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave transition hover:bg-zelanda-beige-50"
            >
              <IconoAlerta tipo={a.icono} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {a.titulo}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-zelanda-verde-700">
                  {a.detalle}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <BadgeBase tono={tonoSeveridad(a.severidad)}>
                  {a.severidad === "critica"
                    ? "Crítica"
                    : a.severidad === "importante"
                      ? "Importante"
                      : "Próxima"}
                </BadgeBase>
                <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AlertasFiltrables({
  criticas,
  importantes,
  informativas,
}: {
  criticas: Alerta[];
  importantes: Alerta[];
  informativas: Alerta[];
}) {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>("TODOS");

  const totalSinFiltro =
    criticas.length + importantes.length + informativas.length;

  const filtrar = (items: Alerta[]): Alerta[] => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (tipo !== "TODOS" && a.icono !== tipo) return false;
      if (q !== "") {
        const matchTitulo = a.titulo.toLowerCase().includes(q);
        const matchDetalle = a.detalle.toLowerCase().includes(q);
        if (!matchTitulo && !matchDetalle) return false;
      }
      return true;
    });
  };

  const criticasFiltradas = useMemo(
    () => filtrar(criticas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [criticas, query, tipo],
  );
  const importantesFiltradas = useMemo(
    () => filtrar(importantes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importantes, query, tipo],
  );
  const informativasFiltradas = useMemo(
    () => filtrar(informativas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [informativas, query, tipo],
  );

  const totalFiltrado =
    criticasFiltradas.length +
    importantesFiltradas.length +
    informativasFiltradas.length;
  const hayFiltros = query.trim() !== "" || tipo !== "TODOS";

  return (
    <div className="space-y-6">
      <p className="text-sm text-zelanda-verde-700">
        {totalSinFiltro === 0
          ? "Todo en orden. No hay alertas activas."
          : hayFiltros
            ? `${totalFiltrado} de ${totalSinFiltro} alerta${
                totalSinFiltro === 1 ? "" : "s"
              } (filtrado)`
            : `${totalSinFiltro} alerta${
                totalSinFiltro === 1 ? "" : "s"
              } activa${totalSinFiltro === 1 ? "" : "s"}.`}
      </p>

      {totalSinFiltro > 0 ? (
        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zelanda-verde-700/50" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por palabra clave..."
              className="block w-full min-h-touch rounded-lg border border-zelanda-beige-300 bg-white pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {ORDEN_FILTRO.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  tipo === t
                    ? "bg-zelanda-verde-700 text-white"
                    : "border border-zelanda-beige-300 bg-white text-zelanda-verde-700"
                }`}
              >
                {ETIQUETAS_FILTRO[t]}
              </button>
            ))}
          </div>
          {hayFiltros ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTipo("TODOS");
              }}
              className="text-xs text-zelanda-verde-700 underline hover:text-zelanda-verde-900"
            >
              Limpiar filtros
            </button>
          ) : null}
        </section>
      ) : null}

      {totalSinFiltro === 0 ? (
        <section className="rounded-xl border border-dashed border-zelanda-verde-300 bg-zelanda-verde-50/40 px-6 py-12 text-center">
          <p className="font-serif text-lg text-zelanda-verde-900">
            Sin alertas
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Cuando aparezcan tareas vencidas, novedades, stock bajo u otros
            eventos importantes, los vas a ver acá.
          </p>
        </section>
      ) : totalFiltrado === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-4 py-8 text-center text-sm text-zelanda-verde-700/70">
          Sin resultados para los filtros seleccionados.
        </p>
      ) : null}

      <BloqueAlertas
        titulo="Críticas"
        descripcion="Requieren atención inmediata"
        icono={<AlertTriangle className="h-5 w-5 text-estado-vencida" />}
        items={criticasFiltradas}
      />

      <BloqueAlertas
        titulo="Importantes"
        descripcion="Tareas vencidas, novedades y despachos sin cerrar"
        icono={<AlertCircle className="h-5 w-5 text-zelanda-ocre-600" />}
        items={importantesFiltradas}
      />

      <BloqueAlertas
        titulo="Próximas"
        descripcion="Vencen en menos de 7 días"
        icono={<Clock className="h-5 w-5 text-zelanda-verde-700" />}
        items={informativasFiltradas}
      />
    </div>
  );
}
