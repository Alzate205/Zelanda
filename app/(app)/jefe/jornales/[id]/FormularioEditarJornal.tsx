'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { editarJornal, type EstadoJornal } from '../acciones';
import { formatearMiles, normalizarEntradaNumerica } from '@/lib/formatos';

const ESTADO_INICIAL: EstadoJornal = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

export function FormularioEditarJornal({
  id,
  nombrePersona,
  fechaIso,
  tarifaInicial,
  loteIdInicial,
  descripcionInicial,
  notasIniciales,
  lotes,
}: {
  id: string;
  nombrePersona: string;
  fechaIso: string;
  tarifaInicial: number;
  loteIdInicial: string;
  descripcionInicial: string;
  notasIniciales: string;
  lotes: { id: string; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(editarJornal, ESTADO_INICIAL);
  const [tarifa, setTarifa] = useState(tarifaInicial > 0 ? String(tarifaInicial) : '');
  const [loteId, setLoteId] = useState(loteIdInicial);
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [notas, setNotas] = useState(notasIniciales);

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={id} />

      <Link
        href="/jefe/jornales"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Jornales
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar jornal
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{nombrePersona}</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">{fechaIso}</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="tarifa_aplicada" className={labelBase}>
            Tarifa del jornal (COP)
          </label>
          <input
            id="tarifa_aplicada"
            name="tarifa_aplicada"
            type="text"
            inputMode="numeric"
            required
            className={inputBase}
            value={formatearMiles(tarifa)}
            onChange={(e) => setTarifa(normalizarEntradaNumerica(e.target.value))}
            placeholder="120.000"
          />
        </div>

        <div>
          <label htmlFor="lote_id" className={labelBase}>
            Lote (opcional)
          </label>
          <select
            id="lote_id"
            name="lote_id"
            className={inputBase}
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
          >
            <option value="">Sin lote</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="descripcion_actividad" className={labelBase}>
            Actividad (opcional)
          </label>
          <input
            id="descripcion_actividad"
            name="descripcion_actividad"
            type="text"
            className={inputBase}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Fertilización lote Armenia"
          />
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            className={inputBase + ' resize-none'}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
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
