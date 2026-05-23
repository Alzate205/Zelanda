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
        <label htmlFor="nombre" className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={valores?.nombre ?? ""}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <div>
        <label htmlFor="categoria" className="block text-sm font-medium text-zelanda-verde-900">
          Categoría
        </label>
        <select
          id="categoria"
          name="categoria"
          required
          defaultValue={valores?.categoria ?? "CULTIVO"}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        >
          <option value="CULTIVO">Cultivo</option>
          <option value="COSECHA">Cosecha</option>
          <option value="APICULTURA">Apicultura</option>
        </select>
      </div>

      <div>
        <label htmlFor="total" className="block text-sm font-medium text-zelanda-verde-900">
          Total disponible
        </label>
        <input
          id="total"
          name="total"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={valores?.total ?? 0}
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
        {pending ? "Guardando..." : modo === "crear" ? "Crear" : "Guardar"}
      </button>
    </form>
  );
}
