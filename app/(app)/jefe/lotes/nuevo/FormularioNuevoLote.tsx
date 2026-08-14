'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { crearLote, type EstadoCreacionLote } from '../acciones';

const ESTADO_INICIAL: EstadoCreacionLote = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';

const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

export function FormularioNuevoLote() {
  const [estado, accion, pendiente] = useActionState(crearLote, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/lotes"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lotes
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Nuevo</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Crear lote</h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="nombre" className={labelBase}>
            Nombre
          </label>
          <input id="nombre" name="nombre" type="text" required autoFocus className={inputBase} />
        </div>

        <div>
          <label htmlFor="hectareas" className={labelBase}>
            Hectáreas (opcional)
          </label>
          <input
            id="hectareas"
            name="hectareas"
            type="text"
            inputMode="decimal"
            className={inputBase}
          />
          <p className="mt-1 text-xs text-zelanda-verde-700">
            Si vas a importar el polígono desde un KML, las hectáreas se recalculan solas.
          </p>
        </div>

        <div>
          <label htmlFor="total_arboles" className={labelBase}>
            Total de árboles
          </label>
          <input
            id="total_arboles"
            name="total_arboles"
            type="number"
            min="0"
            step="1"
            defaultValue={0}
            className={inputBase}
          />
          <p className="mt-1 text-xs text-zelanda-verde-700">
            Se generan las placas 1..N automáticamente. Puedes dejarlo en 0 y cargarlas después.
          </p>
        </div>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/jefe/lotes"
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Creando…' : 'Crear lote'}
        </button>
      </div>
    </form>
  );
}
