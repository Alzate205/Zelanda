"use client";

import { useActionState } from "react";
import { cambiarMiContrasena, type EstadoPerfil } from "./acciones";

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioCambiarContrasena() {
  const [estado, accion, pendiente] = useActionState(cambiarMiContrasena, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <div>
        <label htmlFor="contrasena_nueva" className={labelBase}>Nueva contraseña</label>
        <input
          id="contrasena_nueva"
          name="contrasena_nueva"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputBase}
        />
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Mínimo 8 caracteres.
        </p>
      </div>

      <div>
        <label htmlFor="contrasena_confirmacion" className={labelBase}>Confirmar contraseña</label>
        <input
          id="contrasena_confirmacion"
          name="contrasena_confirmacion"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputBase}
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
        disabled={pendiente}
        className="w-full rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
