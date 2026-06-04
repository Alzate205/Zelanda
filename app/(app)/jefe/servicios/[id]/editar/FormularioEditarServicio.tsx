'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { editarServicio, type EstadoServicio } from '../../acciones';
import { formatearMiles, normalizarEntradaNumerica } from '@/lib/formatos';

const ESTADO_INICIAL: EstadoServicio = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';

const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

type Lote = { id: string; nombre: string };

type ServicioActual = {
  id: string;
  descripcion: string;
  lote_id: string;
  monto_pactado: string;
  fecha_inicio: string;
  fecha_fin: string;
  notas: string;
};

export function FormularioEditarServicio({
  servicio,
  lotes,
}: {
  servicio: ServicioActual;
  lotes: Lote[];
}) {
  const [estado, accion, pendiente] = useActionState(editarServicio, ESTADO_INICIAL);

  const [aplicaALote, setAplicaALote] = useState(!!servicio.lote_id);
  const [montoPactado, setMontoPactado] = useState(servicio.monto_pactado);

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={servicio.id} />

      <Link
        href={`/jefe/servicios/${servicio.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Servicio
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Servicios contratados
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Editar servicio</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          No se puede cambiar la persona ni el estado desde este formulario.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="descripcion" className={labelBase}>
            Descripción del servicio
          </label>
          <input
            id="descripcion"
            name="descripcion"
            type="text"
            required
            defaultValue={servicio.descripcion}
            placeholder="Ej: Reparación del puente, cerca del sector norte"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="monto_pactado" className={labelBase}>
            Monto pactado (COP)
          </label>
          <input
            id="monto_pactado"
            name="monto_pactado"
            type="text"
            inputMode="numeric"
            required
            placeholder="800.000"
            value={formatearMiles(montoPactado)}
            onChange={(e) => setMontoPactado(normalizarEntradaNumerica(e.target.value))}
            className={inputBase}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="fecha_inicio" className={labelBase}>
              Inicio
            </label>
            <input
              id="fecha_inicio"
              name="fecha_inicio"
              type="date"
              required
              defaultValue={servicio.fecha_inicio}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="fecha_fin" className={labelBase}>
              Fin estimado (opcional)
            </label>
            <input
              id="fecha_fin"
              name="fecha_fin"
              type="date"
              defaultValue={servicio.fecha_fin}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label className={labelBase}>Alcance</label>
          <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <button
              type="button"
              onClick={() => setAplicaALote(false)}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                !aplicaALote
                  ? 'bg-white text-zelanda-verde-900 shadow-suave'
                  : 'text-zelanda-verde-700'
              }`}
            >
              Toda la finca
            </button>
            <button
              type="button"
              onClick={() => setAplicaALote(true)}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                aplicaALote
                  ? 'bg-white text-zelanda-verde-900 shadow-suave'
                  : 'text-zelanda-verde-700'
              }`}
            >
              Un lote específico
            </button>
          </div>
          {aplicaALote ? (
            <select
              name="lote_id"
              required={aplicaALote}
              className={`${inputBase} mt-2`}
              defaultValue={servicio.lote_id}
            >
              <option value="">Selecciona lote…</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="lote_id" value="" />
          )}
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            defaultValue={servicio.notas}
            placeholder="Detalles del acuerdo, condiciones, materiales incluidos, etc."
            className={`${inputBase} min-h-[80px] resize-y py-2.5`}
          />
        </div>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-estado-vencida/30 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <Link
            href={`/jefe/servicios/${servicio.id}`}
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendiente}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Check className="h-[18px] w-[18px]" />
            {pendiente ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </form>
  );
}
