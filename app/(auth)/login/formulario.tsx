'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import { iniciarSesion, type EstadoLogin } from './acciones';

const ESTADO_INICIAL: EstadoLogin = { error: null };

export function FormularioLogin({ redirigir }: { redirigir?: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, ESTADO_INICIAL);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <form action={accion} className="flex flex-col gap-6" noValidate>
      {redirigir ? <input type="hidden" name="redirigir" value={redirigir} /> : null}

      <div className="space-y-2">
        <label
          htmlFor="identificador"
          className="block text-xs font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
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
          placeholder="tu_usuario"
          required
          className="h-12 w-full rounded-xl border border-zelanda-beige-300 bg-white px-4 text-[15px] placeholder:text-zelanda-verde-700/40 outline-none transition-all focus:border-zelanda-verde-400 focus:outline focus:outline-2 focus:outline-zelanda-verde-400/20"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={mostrarPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="h-12 w-full rounded-xl border border-zelanda-beige-300 bg-white px-4 pr-12 text-[15px] placeholder:text-zelanda-verde-700/40 outline-none transition-all focus:border-zelanda-verde-400 focus:outline focus:outline-2 focus:outline-zelanda-verde-400/20"
          />
          <button
            type="button"
            onClick={() => setMostrarPassword(!mostrarPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zelanda-verde-700 transition-colors hover:bg-zelanda-beige-100"
            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {mostrarPassword ? (
              <Eye size={20} strokeWidth={2} />
            ) : (
              <EyeOff size={20} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {estado.error ? (
        <div
          role="alert"
          className="rounded-xl border border-estado-vencida/20 bg-estado-vencida/8 px-4 py-3 text-sm text-estado-vencida"
        >
          {estado.error}
        </div>
      ) : null}

      <Boton bloque className="mt-2 h-12 text-base font-semibold" disabled={pendiente}>
        {pendiente ? 'Entrando…' : 'Entrar'}
      </Boton>

      <p className="text-center text-xs text-zelanda-verde-700/60">
        ¿Problemas para entrar?{' '}
        <span className="block mt-1 font-semibold text-zelanda-verde-700">
          Contacta al jefe de la finca
        </span>
      </p>
    </form>
  );
}
