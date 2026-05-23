"use client";

import { useActionState } from "react";
import { marcarResuelta, type EstadoResolucion } from "./acciones";

const ESTADO_INICIAL: EstadoResolucion = { error: null };

export function FormularioResolverNovedad({ novedadId }: { novedadId: string }) {
  const [estado, accion, pendiente] = useActionState(
    marcarResuelta,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="novedad_id" value={novedadId} />
      <div>
        <label
          htmlFor="notas_resolucion"
          className="block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
        >
          ¿Cómo se resolvió? (opcional)
        </label>
        <textarea
          id="notas_resolucion"
          name="notas_resolucion"
          rows={3}
          placeholder="Ej: aplicado tratamiento de cobre, árbol marcado para seguimiento, etc."
          className="mt-1.5 block min-h-[80px] w-full resize-y rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-sm text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20"
        />
      </div>
      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Marcando…" : "Marcar resuelta"}
      </button>
    </form>
  );
}
