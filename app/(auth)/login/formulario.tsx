"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { iniciarSesion, type EstadoLogin } from "./acciones";

const ESTADO_INICIAL: EstadoLogin = { error: null };

export function FormularioLogin({ redirigir }: { redirigir?: string }) {
  const [estado, accion, pendiente] = useActionState(
    iniciarSesion,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      {redirigir ? (
        <input type="hidden" name="redirigir" value={redirigir} />
      ) : null}

      <div>
        <label
          htmlFor="identificador"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
        >
          Usuario o correo
        </label>
        <input
          id="identificador"
          name="identificador"
          type="text"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          required
          className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
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

      <Boton bloque className="mt-3" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
