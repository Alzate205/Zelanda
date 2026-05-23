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
          className="block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
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
          className="mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
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
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 text-sm font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pendiente ? "Guardando…" : "Guardar usuario"}
      </button>
    </form>
  );
}
