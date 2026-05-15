"use client";

import { useActionState } from "react";
import {
  crearHerramienta,
  actualizarHerramienta,
  type EstadoEdicion,
} from "../acciones";

type Valores = {
  id?: string;
  nombre: string;
  categoria: "CULTIVO" | "COSECHA" | "APICULTURA";
  total: number;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioHerramienta({
  modo,
  valores,
}: {
  modo: "crear" | "editar";
  valores?: Valores;
}) {
  const accion = modo === "crear" ? crearHerramienta : actualizarHerramienta;
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
          Total disponible
        </label>
        <input
          name="total"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={valores?.total ?? 0}
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
