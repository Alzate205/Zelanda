"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export type NovedadResumen = {
  id: string;
  tipo: string;
  arbol_numero: number;
  lote_nombre: string;
  persona_nombre: string;
  descripcion: string;
  fecha: string;
  resuelta: boolean;
};

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

type FiltroTipo = "TODOS" | keyof typeof ETIQUETA_NOVEDAD;

const ORDEN_FILTRO: FiltroTipo[] = [
  "TODOS",
  "PLAGA",
  "DANO_FISICO",
  "ENFERMEDAD",
  "OBSERVACION",
  "OTRO",
];

export function ListaNovedadesCliente({
  novedades,
  verResueltas,
}: {
  novedades: NovedadResumen[];
  verResueltas: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>("TODOS");

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return novedades.filter((n) => {
      if (tipo !== "TODOS" && n.tipo !== tipo) return false;
      if (q !== "") {
        const blob = `${n.descripcion} ${n.lote_nombre} ${n.persona_nombre} arbol ${n.arbol_numero}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [novedades, query, tipo]);

  const total = novedades.length;
  const filtrado = filtradas.length;
  const hayFiltros = query.trim() !== "" || tipo !== "TODOS";

  return (
    <div className="space-y-4">
      <nav className="flex gap-1.5">
        <Link
          href="/jefe/novedades"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            !verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Pendientes
        </Link>
        <Link
          href="/jefe/novedades?resueltas=si"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Resueltas
        </Link>
      </nav>

      {total > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zelanda-verde-700/50" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por descripción, lote, persona, árbol..."
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
                {t === "TODOS" ? "Todas" : ETIQUETA_NOVEDAD[t]}
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
          <p className="text-xs text-zelanda-verde-700">
            {hayFiltros
              ? `${filtrado} de ${total} novedad${total === 1 ? "" : "es"}`
              : `${total} novedad${total === 1 ? "" : "es"}`}
          </p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {total === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            {verResueltas
              ? "No hay novedades resueltas."
              : "No hay novedades pendientes."}
          </li>
        ) : filtrado === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700/70">
            Sin resultados para los filtros seleccionados.
          </li>
        ) : (
          filtradas.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
            >
              <Link
                href={`/jefe/novedades/${n.id}`}
                className="flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BadgeBase tono={n.resuelta ? "info" : "alerta"}>
                      {ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo}
                    </BadgeBase>
                    <span className="text-xs text-zelanda-verde-700">
                      {formatearFechaCorta(n.fecha)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zelanda-verde-900">
                    Árbol {n.arbol_numero} · Lote {n.lote_nombre}
                  </p>
                  <p className="truncate text-xs text-zelanda-verde-700">
                    {n.descripcion}
                  </p>
                  <p className="mt-0.5 text-xs text-zelanda-verde-700/80">
                    por {n.persona_nombre}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
