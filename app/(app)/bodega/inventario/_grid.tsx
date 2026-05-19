"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FlaskConical,
  PackagePlus,
  Plus,
  Search,
  Wrench,
} from "lucide-react";

type Categoria = "CULTIVO" | "COSECHA" | "APICULTURA";
type Filtro =
  | "TODOS"
  | "HERRAMIENTAS"
  | "INSUMOS"
  | Categoria;

export type ItemInventario =
  | {
      tipo: "HERRAMIENTA";
      id: string;
      nombre: string;
      categoria: Categoria;
      activo: boolean;
      total: number;
      prestadas: number;
      disponibles: number;
    }
  | {
      tipo: "INSUMO";
      id: string;
      nombre: string;
      categoria: Categoria;
      activo: boolean;
      unidad: string;
      stock_disponible: string;
      stock_minimo: string;
      por_debajo_minimo: boolean;
    };

const ETIQUETA_FILTRO: Record<Filtro, string> = {
  TODOS: "Todos",
  HERRAMIENTAS: "Herramientas",
  INSUMOS: "Insumos",
  CULTIVO: "Cultivo",
  COSECHA: "Cosecha",
  APICULTURA: "Apicultura",
};

const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  CULTIVO: "Cultivo",
  COSECHA: "Cosecha",
  APICULTURA: "Apicultura",
};

export function GridInventario({ items }: { items: ItemInventario[] }) {
  const [cat, setCat] = useState<Filtro>("TODOS");
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (cat === "HERRAMIENTAS" && i.tipo !== "HERRAMIENTA") return false;
      if (cat === "INSUMOS" && i.tipo !== "INSUMO") return false;
      if (
        (cat === "CULTIVO" || cat === "COSECHA" || cat === "APICULTURA") &&
        i.categoria !== cat
      ) {
        return false;
      }
      if (q !== "" && !i.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, cat, query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link
          href="/bodega/inventario/herramientas/nueva"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-2 text-sm text-zelanda-verde-700"
        >
          <Wrench className="h-4 w-4" /> <Plus className="h-3.5 w-3.5" /> Herramienta
        </Link>
        <Link
          href="/bodega/inventario/insumos/nuevo"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-2 text-sm text-zelanda-verde-700"
        >
          <FlaskConical className="h-4 w-4" /> <Plus className="h-3.5 w-3.5" /> Insumo
        </Link>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zelanda-verde-700/50" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar..."
          className="block w-full min-h-touch rounded-lg border border-zelanda-beige-300 pl-9 pr-3 py-2"
        />
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {(
          [
            "TODOS",
            "HERRAMIENTAS",
            "INSUMOS",
            "CULTIVO",
            "COSECHA",
            "APICULTURA",
          ] as const
        ).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              cat === c
                ? "bg-zelanda-verde-700 text-white"
                : "border border-zelanda-beige-300 text-zelanda-verde-700"
            }`}
          >
            {ETIQUETA_FILTRO[c]}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 px-4 py-8 text-center text-sm text-zelanda-verde-700/70">
          Sin resultados.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtrados.map((i) => (
            <CardItem key={`${i.tipo}-${i.id}`} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardItem({ item }: { item: ItemInventario }) {
  const hrefEditar =
    item.tipo === "HERRAMIENTA"
      ? `/bodega/inventario/herramientas/${item.id}/editar`
      : `/bodega/inventario/insumos/${item.id}/editar`;

  if (item.tipo === "HERRAMIENTA") {
    const sinStock = item.disponibles <= 0;
    return (
      <article
        className={`flex flex-col rounded-xl border p-3 shadow-card ${
          !item.activo
            ? "border-zelanda-beige-200 bg-zelanda-beige-100/40 opacity-60"
            : sinStock
              ? "border-estado-vencida/40 bg-white"
              : "border-zelanda-beige-200 bg-white"
        }`}
      >
        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zelanda-verde-700/60">
          <Wrench className="h-3 w-3" />
          {ETIQUETA_CATEGORIA[item.categoria]}
        </p>

        <p
          className={`mt-2 font-serif text-4xl leading-none ${
            sinStock ? "text-estado-vencida" : "text-zelanda-verde-900"
          }`}
        >
          {item.disponibles}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-zelanda-verde-700/70">
          disponible{item.disponibles === 1 ? "" : "s"}
        </p>

        <Link
          href={hrefEditar}
          className="mt-3 truncate font-medium text-zelanda-verde-900 hover:underline"
        >
          {item.nombre}
        </Link>
        <p className="text-[11px] text-zelanda-verde-700/60">
          de {item.total} total
          {item.prestadas > 0 && ` · ${item.prestadas} prestada${item.prestadas === 1 ? "" : "s"}`}
        </p>
      </article>
    );
  }

  const disponible = Number(item.stock_disponible);
  const minimo = Number(item.stock_minimo);

  return (
    <article
      className={`flex flex-col rounded-xl border p-3 shadow-card ${
        !item.activo
          ? "border-zelanda-beige-200 bg-zelanda-beige-100/40 opacity-60"
          : item.por_debajo_minimo
            ? "border-estado-vencida/40 bg-white"
            : "border-zelanda-beige-200 bg-white"
      }`}
    >
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zelanda-verde-700/60">
        <FlaskConical className="h-3 w-3" />
        {ETIQUETA_CATEGORIA[item.categoria]}
      </p>

      <p
        className={`mt-2 font-serif text-3xl leading-none ${
          item.por_debajo_minimo ? "text-estado-vencida" : "text-zelanda-verde-900"
        }`}
      >
        {disponible.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
        <span className="ml-1 text-base text-zelanda-verde-700/70">
          {item.unidad}
        </span>
      </p>
      <p className="text-[11px] uppercase tracking-wider text-zelanda-verde-700/70">
        disponible
      </p>

      <Link
        href={hrefEditar}
        className="mt-3 truncate font-medium text-zelanda-verde-900 hover:underline"
      >
        {item.nombre}
      </Link>
      {item.por_debajo_minimo ? (
        <p className="text-[11px] text-estado-vencida">
          bajo mín ({minimo.toLocaleString("es-CO", { maximumFractionDigits: 2 })}{" "}
          {item.unidad})
        </p>
      ) : (
        <p className="text-[11px] text-zelanda-verde-700/60">
          mín {minimo.toLocaleString("es-CO", { maximumFractionDigits: 2 })}{" "}
          {item.unidad}
        </p>
      )}

      <Link
        href={`/bodega/inventario/insumos/${item.id}/ingresar`}
        className="mt-2 inline-flex items-center gap-1 self-start rounded-lg border border-zelanda-verde-700 px-2 py-1 text-[11px] text-zelanda-verde-700"
      >
        <PackagePlus className="h-3 w-3" /> Ingresar
      </Link>
      <Link
        href={`/bodega/inventario/insumos/${item.id}/historial`}
        className="mt-1 self-start text-[11px] text-zelanda-verde-700 underline"
      >
        Ver historial
      </Link>
    </article>
  );
}
