"use client";

import { useActionState } from "react";
import {
  crearInsumo,
  actualizarInsumo,
  type EstadoEdicion,
} from "../acciones";

type Valores = {
  id?: string;
  nombre: string;
  categoria: "CULTIVO" | "COSECHA" | "APICULTURA";
  unidad: string;
  stock_minimo: string;
  costo_unitario: string | null;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioInsumo({
  modo,
  valores,
}: {
  modo: "crear" | "editar";
  valores?: Valores;
}) {
  const accion = modo === "crear" ? crearInsumo : actualizarInsumo;
  const [estado, formAction, pending] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-4">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          name="nombre"
          required
          defaultValue={valores?.nombre ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Categoría
        </label>
        <select
          name="categoria"
          required
          defaultValue={valores?.categoria ?? "CULTIVO"}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="CULTIVO">Cultivo</option>
          <option value="COSECHA">Cosecha</option>
          <option value="APICULTURA">Apicultura</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Unidad
        </label>
        <input
          name="unidad"
          required
          placeholder="L, kg, unidades, m..."
          defaultValue={valores?.unidad ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Stock mínimo
        </label>
        <input
          name="stock_minimo"
          type="number"
          min="0"
          step="0.001"
          required
          defaultValue={valores?.stock_minimo ?? "0"}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Costo unitario (opcional)
        </label>
        <input
          name="costo_unitario"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={valores?.costo_unitario ?? ""}
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
        {pending ? "Guardando..." : modo === "crear" ? "Crear" : "Guardar"}
      </button>
    </form>
  );
}
