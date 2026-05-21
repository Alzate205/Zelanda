"use client";

import { useActionState } from "react";
import { actualizarMiUsername } from "./acciones";

const ESTADO_INICIAL = { error: null as string | null, exito: null as string | null };

export function FormularioUsername({
  usernameInicial,
}: {
  usernameInicial: string | null;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarMiUsername,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-zelanda-verde-800"
        >
          Nombre de usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoCapitalize="off"
          spellCheck={false}
          defaultValue={usernameInicial ?? ""}
          placeholder="ej. alber"
          className="mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20"
        />
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Letras minúsculas, números y los símbolos _ . - (3 a 30 caracteres).
          Dejá vacío para borrarlo.
        </p>
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
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2.5 text-sm font-medium text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60"
      >
        {pendiente ? "Guardando…" : "Guardar usuario"}
      </button>
    </form>
  );
}
