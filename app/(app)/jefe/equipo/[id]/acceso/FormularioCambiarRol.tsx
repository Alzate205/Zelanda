"use client";

import { useActionState } from "react";
import { cambiarRolUsuario, type EstadoAcceso } from "./acciones";
import type { RolUsuario } from "@/types";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioCambiarRol({
  personaId,
  usuarioId,
  rolActual,
}: {
  personaId: string;
  usuarioId: string;
  rolActual: RolUsuario;
}) {
  const [estado, accion, pendiente] = useActionState(
    cambiarRolUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="persona_id" value={personaId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />

      <div>
        <label htmlFor="rol" className={labelBase}>
          Rol en la app
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue={rolActual}
          required
          className={inputBase}
        >
          <option value="TRABAJADOR">Trabajador</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="JEFE">Jefe</option>
        </select>
      </div>

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-zelanda-verde-300 bg-zelanda-verde-50 px-3 py-2 text-sm text-zelanda-verde-800"
        >
          {estado.exito}
        </p>
      ) : null}
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
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 text-sm font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pendiente ? "Guardando…" : "Cambiar rol"}
      </button>
    </form>
  );
}
