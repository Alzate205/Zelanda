'use client';

import { useActionState } from 'react';
import { crearAccesoParaPersona, type EstadoAcceso } from './acciones';
import { MIN_CLAVE } from '@/lib/acceso';

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

export function FormularioCrearAcceso({
  personaId,
  usernameSugerido = '',
}: {
  personaId: string;
  /** Primer nombre de la persona, propuesto como usuario. Editable. */
  usernameSugerido?: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearAccesoParaPersona, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="persona_id" value={personaId} />

      <div>
        <label htmlFor="username" className={labelBase}>
          Nombre de usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={usernameSugerido}
          required
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-zelanda-verde-700">
          Con esto entra a la app. No hace falta correo.
        </p>
      </div>

      <div>
        <label htmlFor="password" className={labelBase}>
          Clave
        </label>
        <input
          id="password"
          name="password"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          minLength={MIN_CLAVE}
          required
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-zelanda-verde-700">
          Mínimo {MIN_CLAVE} caracteres: pueden ser 4 números, como 1234. Se ve mientras la escribes
          para que puedas dictársela.
        </p>
      </div>

      <div>
        <label htmlFor="rol" className={labelBase}>
          Rol en la app
        </label>
        <select id="rol" name="rol" defaultValue="TRABAJADOR" required className={inputBase}>
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
        {pendiente ? 'Creando…' : 'Dar acceso'}
      </button>
    </form>
  );
}
