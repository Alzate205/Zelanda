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
import { AsignarMasivoBox } from "@/components/jefe/AsignarMasivoBox";

export type Severidad = "critica" | "importante" | "informativa";

export type IconoAlertaTipo =
  | "task"
  | "stock"
  | "novedad"
  | "despacho"
  | "apiario";

export type BulkInfo = {
  tipo_tarea_id: string;
  kind: "lote" | "apiario";
  destino_id: string;
};

export type Alerta = {
  id: string;
  severidad: Severidad;
  icono: IconoAlertaTipo;
  titulo: string;
  detalle: string;
  url: string;
  clave_grupo: string | null;
  bulk_info: BulkInfo | null;
};

type Persona = { id: string; nombre: string };

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

function etiquetaSeveridad(s: Severidad): string {
  if (s === "critica") return "Crítica";
  if (s === "importante") return "Importante";
  return "Próxima";
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

type EntradaListado =
  | { kind: "individual"; alerta: Alerta }
  | { kind: "grupo"; clave: string; alertas: Alerta[] };

function construirListado(items: Alerta[]): EntradaListado[] {
  const listado: EntradaListado[] = [];
  const indicePorClave = new Map<string, number>();
  for (const a of items) {
    if (a.clave_grupo === null) {
      listado.push({ kind: "individual", alerta: a });
      continue;
    }
    const existente = indicePorClave.get(a.clave_grupo);
    if (existente !== undefined) {
      const grupo = listado[existente];
      if (grupo.kind === "grupo") grupo.alertas.push(a);
      continue;
    }
    indicePorClave.set(a.clave_grupo, listado.length);
    listado.push({ kind: "grupo", clave: a.clave_grupo, alertas: [a] });
  }
  return listado.map((e) =>
    e.kind === "grupo" && e.alertas.length === 1
      ? { kind: "individual" as const, alerta: e.alertas[0] }
      : e,
  );
}

function AlertaIndividualItem({ alerta }: { alerta: Alerta }) {
  return (
    <li>
      <Link
        href={alerta.url}
        className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave transition hover:bg-zelanda-beige-50"
      >
        <IconoAlerta tipo={alerta.icono} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zelanda-verde-900">
            {alerta.titulo}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-zelanda-verde-700">
            {alerta.detalle}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <BadgeBase tono={tonoSeveridad(alerta.severidad)}>
            {etiquetaSeveridad(alerta.severidad)}
          </BadgeBase>
          <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
        </div>
      </Link>
    </li>
  );
}

function GrupoEntradaAlerta({
  clave,
  alertas,
  expandido,
  onToggle,
  personas,
}: {
  clave: string;
  alertas: Alerta[];
  expandido: boolean;
  onToggle: () => void;
  personas: Persona[];
}) {
  const cantidad = alertas.length;
  const iconoTipo = alertas[0].icono;

  const bulkInfos = alertas
    .map((a) => a.bulk_info)
    .filter((b): b is BulkInfo => b !== null);
  const tipoTareaIds = new Set(bulkInfos.map((b) => b.tipo_tarea_id));
  const kinds = new Set(bulkInfos.map((b) => b.kind));
  const puedeBulk =
    bulkInfos.length === alertas.length &&
    tipoTareaIds.size === 1 &&
    kinds.size === 1;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 text-left shadow-suave transition hover:bg-zelanda-beige-50"
      >
        <IconoAlerta tipo={iconoTipo} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zelanda-verde-900">{clave}</p>
          <p className="mt-0.5 text-xs text-zelanda-verde-700">
            {cantidad} alerta{cantidad === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-zelanda-verde-700/40 transition-transform ${expandido ? "rotate-90" : ""}`}
        />
      </button>
      {expandido ? (
        <div className="ml-3 mt-2 space-y-2 border-l border-zelanda-beige-200 pl-3">
          {puedeBulk ? (
            <AsignarMasivoBox
              tipoTareaId={bulkInfos[0].tipo_tarea_id}
              kind={bulkInfos[0].kind}
              destinoIds={bulkInfos.map((b) => b.destino_id)}
              personas={personas}
            />
          ) : null}
          <ul className="space-y-1.5">
            {alertas.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.url}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zelanda-verde-900">
                      {a.titulo}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zelanda-verde-700">
                      {a.detalle}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function BloqueAlertas({
  titulo,
  descripcion,
  icono,
  items,
  personas,
}: {
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  items: Alerta[];
  personas: Persona[];
}) {
  const listado = useMemo(() => construirListado(items), [items]);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  const alternar = (clave: string) =>
    setExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });

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
        {listado.map((e) =>
          e.kind === "individual" ? (
            <AlertaIndividualItem key={e.alerta.id} alerta={e.alerta} />
          ) : (
            <GrupoEntradaAlerta
              key={`${titulo}__${e.clave}`}
              clave={e.clave}
              alertas={e.alertas}
              expandido={expandidas.has(e.clave)}
              onToggle={() => alternar(e.clave)}
              personas={personas}
            />
          ),
        )}
      </ul>
    </section>
  );
}

export function AlertasFiltrables({
  criticas,
  importantes,
  informativas,
  personas,
}: {
  criticas: Alerta[];
  importantes: Alerta[];
  informativas: Alerta[];
  personas: Persona[];
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
        const matchGrupo =
          a.clave_grupo !== null &&
          a.clave_grupo.toLowerCase().includes(q);
        if (!matchTitulo && !matchDetalle && !matchGrupo) return false;
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
        personas={personas}
      />

      <BloqueAlertas
        titulo="Importantes"
        descripcion="Tareas vencidas, novedades y despachos sin cerrar"
        icono={<AlertCircle className="h-5 w-5 text-zelanda-ocre-600" />}
        items={importantesFiltradas}
        personas={personas}
      />

      <BloqueAlertas
        titulo="Próximas"
        descripcion="Vencen en menos de 7 días"
        icono={<Clock className="h-5 w-5 text-zelanda-verde-700" />}
        items={informativasFiltradas}
        personas={personas}
      />
    </div>
  );
}
