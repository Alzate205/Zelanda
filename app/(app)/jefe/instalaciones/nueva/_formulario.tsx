"use client";

import { useActionState } from "react";
import { crearInstalacion, type EstadoEdicion } from "@/lib/acciones-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioNuevaInstalacion() {
  const [estado, formAction, pending] = useActionState(
    crearInstalacion,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          name="nombre"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Tipo
        </label>
        <select
          name="tipo"
          required
          defaultValue="OTRO"
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="CASA">Casa</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
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
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pending ? "Creando..." : "Crear y capturar ubicación"}
      </button>
    </form>
  );
}
