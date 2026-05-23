"use client";

import { useActionState } from "react";
import { crearAccesoParaPersona, type EstadoAcceso } from "./acciones";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";
const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

export function FormularioCrearAcceso({ personaId }: { personaId: string }) {
  const [estado, accion, pendiente] = useActionState(
    crearAccesoParaPersona,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="persona_id" value={personaId} />

      <div>
        <label htmlFor="email" className={labelBase}>
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelBase}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-zelanda-verde-700">
          Mínimo 8 caracteres. Compártela por canal seguro.
        </p>
      </div>

      <div>
        <label htmlFor="rol" className={labelBase}>
          Rol en la app
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue="TRABAJADOR"
          required
          className={inputBase}
        >
          <option value="TRABAJADOR">Trabajador</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="JEFE">Jefe</option>
        </select>
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
        className="min-h-touch w-full rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Creando…" : "Dar acceso"}
      </button>
    </form>
  );
}
