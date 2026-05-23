"use client";

import { useActionState } from "react";
import { resetearContrasenaUsuario, type EstadoAcceso } from "./acciones";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioResetContrasena({
  usuarioId,
}: {
  usuarioId: string;
}) {
  const [estado, accion, pendiente] = useActionState(
    resetearContrasenaUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3" noValidate>
      <input type="hidden" name="usuario_id" value={usuarioId} />

      <div>
        <label htmlFor="contrasena_nueva" className={labelBase}>
          Nueva contraseña
        </label>
        <input
          id="contrasena_nueva"
          name="contrasena_nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="contrasena_confirmacion" className={labelBase}>
          Confirmar
        </label>
        <input
          id="contrasena_confirmacion"
          name="contrasena_confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
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
        {pendiente ? "Reseteando…" : "Resetear contraseña"}
      </button>
    </form>
  );
}
