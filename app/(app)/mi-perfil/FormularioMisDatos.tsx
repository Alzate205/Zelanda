"use client";

import { useActionState } from "react";
import { actualizarMisDatos, type EstadoPerfil } from "./acciones";

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type DatosIniciales = {
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  notas: string | null;
  vinculadoAPersona: boolean;
};

export function FormularioMisDatos({ datos }: { datos: DatosIniciales }) {
  const [estado, accion, pendiente] = useActionState(actualizarMisDatos, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      {!datos.vinculadoAPersona ? (
        <p className="rounded-md border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-verde-800">
          Tu cuenta aún no está vinculada a una persona en la finca. Pídele
          al jefe que te asocie para poder editar tus datos.
        </p>
      ) : null}

      <div>
        <label htmlFor="nombre_completo" className={labelBase}>Nombre completo</label>
        <input
          id="nombre_completo"
          name="nombre_completo"
          type="text"
          required
          defaultValue={datos.nombre_completo}
          disabled={!datos.vinculadoAPersona}
          className={inputBase}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cedula" className={labelBase}>Cédula</label>
          <input
            id="cedula"
            name="cedula"
            type="text"
            defaultValue={datos.cedula ?? ""}
            disabled={!datos.vinculadoAPersona}
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="telefono" className={labelBase}>Teléfono</label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            defaultValue={datos.telefono ?? ""}
            disabled={!datos.vinculadoAPersona}
            className={inputBase}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notas" className={labelBase}>Notas</label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          defaultValue={datos.notas ?? ""}
          disabled={!datos.vinculadoAPersona}
          className={`${inputBase} min-h-[60px] resize-y`}
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

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-estado-aldia/20 bg-estado-aldia/10 px-3 py-2 text-sm text-estado-aldia"
        >
          {estado.exito}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || !datos.vinculadoAPersona}
        className="w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
