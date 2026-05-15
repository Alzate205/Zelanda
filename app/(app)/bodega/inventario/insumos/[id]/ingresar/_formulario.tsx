"use client";

import { useActionState } from "react";
import { ingresarStock, type EstadoEdicion } from "../../../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioIngresoStock({
  insumoId,
  unidad,
}: {
  insumoId: string;
  unidad: string;
}) {
  const [estado, formAction, pending] = useActionState(
    ingresarStock,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="insumo_id" value={insumoId} />

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad ({unidad})
        </label>
        <input
          name="cantidad"
          type="number"
          min="0.001"
          step="0.001"
          required
          autoFocus
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={3}
          placeholder="ej: compra del 12/05 a CampoFuerte"
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
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
        {pending ? "Registrando..." : "Registrar ingreso"}
      </button>
    </form>
  );
}
