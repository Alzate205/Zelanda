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
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
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
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
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
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
