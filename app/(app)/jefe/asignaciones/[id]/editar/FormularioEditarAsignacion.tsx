'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { editarAsignacion, type EstadoAsignacion } from '../../acciones';

const ESTADO_INICIAL: EstadoAsignacion = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const inputDeshabilitado =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-200 bg-zelanda-beige-50 px-3 text-[15px] text-zelanda-verde-700 cursor-not-allowed';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

export function FormularioEditarAsignacion({
  id,
  destinoLabel,
  tipoTareaNombre,
  personaIdActual,
  fechaInicioIso,
  puedeReasignar,
  personas,
}: {
  id: string;
  destinoLabel: string;
  tipoTareaNombre: string;
  personaIdActual: string;
  fechaInicioIso: string;
  puedeReasignar: boolean;
  personas: { id: string; nombre_completo: string; vinculo: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(editarAsignacion, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={id} />

      <Link
        href={`/jefe/asignaciones/${id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al detalle
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar asignación
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{tipoTareaNombre}</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">{destinoLabel}</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        {/* Destino y tipo de tarea (solo lectura) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={labelBase}>Destino</p>
            <p className="mt-1.5 rounded-[10px] border border-zelanda-beige-200 bg-zelanda-beige-50 px-3 py-2 text-[15px] text-zelanda-verde-700">
              {destinoLabel}
            </p>
          </div>
          <div>
            <p className={labelBase}>Tipo de tarea</p>
            <p className="mt-1.5 rounded-[10px] border border-zelanda-beige-200 bg-zelanda-beige-50 px-3 py-2 text-[15px] text-zelanda-verde-700">
              {tipoTareaNombre}
            </p>
          </div>
        </div>

        {/* Persona asignada */}
        <div>
          <label htmlFor="persona_id" className={labelBase}>
            Persona asignada
          </label>
          {puedeReasignar ? (
            <select
              id="persona_id"
              name="persona_id"
              defaultValue={personaIdActual}
              className={inputBase}
              required
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo} — {p.vinculo}
                </option>
              ))}
            </select>
          ) : (
            <>
              {/* Enviar el valor de todas formas */}
              <input type="hidden" name="persona_id" value={personaIdActual} />
              <p className={inputDeshabilitado + ' py-2'}>
                {personas.find((p) => p.id === personaIdActual)?.nombre_completo ?? '—'}
              </p>
              <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p className="text-[12px] text-amber-700">
                  Ya hay avances registrados. No es posible reasignar. Cancelá y creá una nueva
                  asignación si es necesario.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Fecha de inicio */}
        <div>
          <label htmlFor="fecha_inicio" className={labelBase}>
            Fecha de inicio
          </label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            defaultValue={fechaInicioIso}
            className={inputBase + ' py-2'}
          />
        </div>
      </section>

      {estado.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{estado.error}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-3 backdrop-blur safe-bottom">
        <button
          type="submit"
          disabled={pendiente}
          className="flex w-full min-h-touch items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          {pendiente ? (
            'Guardando…'
          ) : (
            <>
              <Check className="h-4 w-4" /> Guardar cambios
            </>
          )}
        </button>
      </div>
    </form>
  );
}
