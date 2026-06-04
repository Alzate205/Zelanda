'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { editarAusencia, type EstadoAusencia } from '../acciones';
import type { tipo_ausencia } from '@prisma/client';

const ESTADO_INICIAL: EstadoAusencia = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

const OPCIONES_TIPO: { valor: tipo_ausencia; etiqueta: string }[] = [
  { valor: 'FALTA_INJUSTIFICADA', etiqueta: 'Falta injustificada' },
  { valor: 'INCAPACIDAD', etiqueta: 'Incapacidad' },
  { valor: 'VACACIONES', etiqueta: 'Vacaciones' },
  { valor: 'LICENCIA', etiqueta: 'Licencia' },
  { valor: 'PERMISO', etiqueta: 'Permiso' },
];

export function FormularioEditarAusencia({
  id,
  nombrePersona,
  fechaIso,
  tipoInicial,
  descontableInicial,
  observacionesIniciales,
}: {
  id: string;
  nombrePersona: string;
  fechaIso: string;
  tipoInicial: tipo_ausencia;
  descontableInicial: boolean;
  observacionesIniciales: string;
}) {
  const [estado, accion, pendiente] = useActionState(editarAusencia, ESTADO_INICIAL);
  const [fecha, setFecha] = useState(fechaIso);
  const [tipo, setTipo] = useState<tipo_ausencia>(tipoInicial);
  const [descontable, setDescontable] = useState(descontableInicial ? 'true' : 'false');
  const [observaciones, setObservaciones] = useState(observacionesIniciales);

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={id} />

      <Link
        href="/jefe/ausencias"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Ausencias
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar ausencia
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{nombrePersona}</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">{fechaIso}</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="fecha" className={labelBase}>
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            className={inputBase}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="tipo" className={labelBase}>
            Tipo de ausencia
          </label>
          <select
            id="tipo"
            name="tipo"
            className={inputBase}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as tipo_ausencia)}
          >
            {OPCIONES_TIPO.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="descontable" className={labelBase}>
            Descuenta del sueldo
          </label>
          <select
            id="descontable"
            name="descontable"
            className={inputBase}
            value={descontable}
            onChange={(e) => setDescontable(e.target.value)}
          >
            <option value="true">Sí descuenta</option>
            <option value="false">No descuenta</option>
          </select>
        </div>

        <div>
          <label htmlFor="observaciones" className={labelBase}>
            Observaciones (opcional)
          </label>
          <textarea
            id="observaciones"
            name="observaciones"
            rows={2}
            className={inputBase + ' resize-none'}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
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
