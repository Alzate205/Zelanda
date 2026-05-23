"use client";

import { useActionState } from "react";
import { ajustarStock, type EstadoEdicion } from "../../../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioAjusteStock({
  insumoId,
  unidad,
}: {
  insumoId: string;
  unidad: string;
}) {
  const [estado, formAction, pending] = useActionState(
    ajustarStock,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="insumo_id" value={insumoId} />

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad ({unidad})
        </label>
        <input
          name="cantidad"
          type="number"
          step="0.001"
          required
          placeholder="Positivo para sumar, negativo para restar"
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
        <p className="mt-1 text-[11px] text-zelanda-verde-700/60">
          Ejemplo: <code>-2.5</code> para restar 2.5 {unidad}.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Motivo
        </label>
        <input
          name="motivo"
          required
          placeholder="ej: galón roto, conteo físico, devolución a proveedor"
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pending ? "Registrando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
