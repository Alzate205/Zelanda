"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarLote, type EstadoEdicionLote } from "../acciones";

const ESTADO_INICIAL: EstadoEdicionLote = { error: null, aviso: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Lote = {
  id: string;
  nombre: string;
  hectareas: string | null;
  fecha_siembra: string | null;
  total_arboles: number;
  notas: string | null;
};

export function FormularioEditarLote({ lote }: { lote: Lote }) {
  const [estado, accion, pendiente] = useActionState(actualizarLote, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="lote_id" value={lote.id} />

      <Link
        href={`/jefe/lotes/${lote.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {lote.nombre}
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información del lote
        </h2>

        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={lote.nombre}
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hectareas" className={labelBase}>Hectáreas</label>
            <input
              id="hectareas"
              name="hectareas"
              type="number"
              min="0"
              step="0.01"
              defaultValue={lote.hectareas ?? ""}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="fecha_siembra" className={labelBase}>Fecha de siembra</label>
            <input
              id="fecha_siembra"
              name="fecha_siembra"
              type="date"
              defaultValue={lote.fecha_siembra ?? ""}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor="total_arboles" className={labelBase}>
            Total de árboles
          </label>
          <input
            id="total_arboles"
            name="total_arboles"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={lote.total_arboles}
            className={inputBase}
          />
          <p className="mt-1 text-xs text-zelanda-verde-700">
            Si aumentas este número, se generarán los árboles faltantes
            (numerados 1..N) automáticamente.
          </p>
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>Notas</label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            defaultValue={lote.notas ?? ""}
            className={`${inputBase} min-h-[80px] resize-y`}
          />
        </div>
      </section>

      {estado.aviso ? (
        <p
          role="status"
          className="rounded-md border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-verde-800"
        >
          {estado.aviso}
        </p>
      ) : null}

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href={`/jefe/lotes/${lote.id}`}
          className="flex-1 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
