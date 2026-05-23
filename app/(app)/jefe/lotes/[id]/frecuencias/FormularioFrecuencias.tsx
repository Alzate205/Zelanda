"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { guardarFrecuencias, type EstadoFrecuencias } from "./acciones";

const ESTADO_INICIAL: EstadoFrecuencias = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

type Tipo = {
  id: string;
  nombre: string;
  frecuencia_dias_default: number;
  override: number | null;
};

export function FormularioFrecuencias({
  loteId,
  loteNombre,
  tipos,
}: {
  loteId: string;
  loteNombre: string;
  tipos: Tipo[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarFrecuencias, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="lote_id" value={loteId} />

      <Link
        href={`/jefe/lotes/${loteId}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {loteNombre}
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Configuración
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Frecuencias por tipo
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Sobrescribe la frecuencia por defecto para este lote. Deja vacío para usar el default.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        {tipos.map((t) => (
          <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label htmlFor={`frec_${t.id}`} className="block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
                {t.nombre}
              </label>
              <p className="mt-0.5 text-xs text-zelanda-verde-700">
                Default: cada {t.frecuencia_dias_default} días
              </p>
            </div>
            <input
              id={`frec_${t.id}`}
              name={`frec_${t.id}`}
              type="number"
              min="1"
              step="1"
              defaultValue={t.override ?? ""}
              placeholder={String(t.frecuencia_dias_default)}
              className={`${inputBase} sm:w-32`}
            />
          </div>
        ))}
      </section>

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
          href={`/jefe/lotes/${loteId}`}
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
