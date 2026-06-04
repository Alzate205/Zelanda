'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { editarTarifa, type EstadoTarifa } from '../acciones';
import { formatearMiles, normalizarEntradaNumerica } from '@/lib/formatos';
import type { esquema_pago_actividad } from '@prisma/client';

const ESTADO_INICIAL: EstadoTarifa = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';

const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

type Tipo = { id: string; nombre: string; area: 'CULTIVO' | 'APICULTURA' };
type Lote = { id: string; nombre: string };

const ESQUEMAS: { id: esquema_pago_actividad; etiqueta: string; unidad: string }[] = [
  { id: 'POR_JORNAL', etiqueta: 'Por jornal', unidad: 'día' },
  { id: 'POR_KG', etiqueta: 'Por kg', unidad: 'kg' },
  { id: 'POR_ARBOL', etiqueta: 'Por árbol', unidad: 'árbol' },
  { id: 'POR_HECTAREA', etiqueta: 'Por ha', unidad: 'ha' },
  { id: 'POR_HORA', etiqueta: 'Por hora', unidad: 'hora' },
  { id: 'OTRO', etiqueta: 'Otro', unidad: '' },
];

export function FormularioEditarTarifa({
  id,
  tipoTareaIdInicial,
  esquemaPagoInicial,
  montoInicial,
  unidadInicial,
  vigenteDesdIso,
  vigenteHastaIso,
  loteIdInicial,
  notasIniciales,
  tipos,
  lotes,
}: {
  id: string;
  tipoTareaIdInicial: string;
  esquemaPagoInicial: esquema_pago_actividad;
  montoInicial: number;
  unidadInicial: string;
  vigenteDesdIso: string;
  vigenteHastaIso: string;
  loteIdInicial: string;
  notasIniciales: string;
  tipos: Tipo[];
  lotes: Lote[];
}) {
  const [estado, accion, pendiente] = useActionState(editarTarifa, ESTADO_INICIAL);
  const [esquema, setEsquema] = useState<esquema_pago_actividad>(esquemaPagoInicial);
  const [aplicaALote, setAplicaALote] = useState(!!loteIdInicial);
  const [loteId, setLoteId] = useState(loteIdInicial);
  const [monto, setMonto] = useState(montoInicial > 0 ? String(montoInicial) : '');

  const unidadSugerida = ESQUEMAS.find((e) => e.id === esquema)?.unidad ?? '';

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={id} />

      <Link
        href="/jefe/tarifas"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Tarifas
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Editar</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Editar tarifa</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Modificá los campos y guardá para actualizar.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="tipo_tarea_id" className={labelBase}>
            Tipo de tarea
          </label>
          <select
            id="tipo_tarea_id"
            name="tipo_tarea_id"
            required
            className={inputBase}
            defaultValue={tipoTareaIdInicial}
          >
            <option value="">Selecciona…</option>
            <optgroup label="Cultivo">
              {tipos
                .filter((t) => t.area === 'CULTIVO')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Apicultura">
              {tipos
                .filter((t) => t.area === 'APICULTURA')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className={labelBase}>Cómo se paga</label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {ESQUEMAS.map((e) => (
              <label
                key={e.id}
                className={`flex cursor-pointer items-center justify-center rounded-[10px] border px-2 py-2 text-[12.5px] font-semibold transition ${
                  esquema === e.id
                    ? 'border-zelanda-verde-700 bg-zelanda-verde-50 text-zelanda-verde-900'
                    : 'border-zelanda-beige-300 bg-white text-zelanda-verde-700 hover:bg-zelanda-beige-50'
                }`}
              >
                <input
                  type="radio"
                  name="esquema_pago"
                  value={e.id}
                  checked={esquema === e.id}
                  onChange={() => setEsquema(e.id)}
                  className="sr-only"
                />
                {e.etiqueta}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="monto" className={labelBase}>
              Monto (COP)
            </label>
            <input
              id="monto"
              name="monto"
              type="text"
              inputMode="numeric"
              required
              placeholder="80.000"
              value={formatearMiles(monto)}
              onChange={(e) => setMonto(normalizarEntradaNumerica(e.target.value))}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="unidad" className={labelBase}>
              Unidad
            </label>
            <input
              id="unidad"
              name="unidad"
              type="text"
              defaultValue={unidadInicial || unidadSugerida}
              placeholder={unidadSugerida || 'ej. servicio'}
              className={inputBase}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vigente_desde" className={labelBase}>
              Vigente desde
            </label>
            <input
              id="vigente_desde"
              name="vigente_desde"
              type="date"
              required
              defaultValue={vigenteDesdIso}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="vigente_hasta" className={labelBase}>
              Hasta (opcional)
            </label>
            <input
              id="vigente_hasta"
              name="vigente_hasta"
              type="date"
              defaultValue={vigenteHastaIso}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label className={labelBase}>Alcance</label>
          <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <button
              type="button"
              onClick={() => {
                setAplicaALote(false);
                setLoteId('');
              }}
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
              Solo un lote
            </button>
          </div>
          {aplicaALote ? (
            <select
              name="lote_id"
              required={aplicaALote}
              className={`${inputBase} mt-2`}
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
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
          <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
            {aplicaALote
              ? 'Esta tarifa solo aplica en el lote elegido; sobreescribe la tarifa general.'
              : 'Aplica a todos los lotes a menos que haya un override específico.'}
          </p>
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            defaultValue={notasIniciales}
            placeholder="Detalles del acuerdo, condiciones, etc."
            className={`${inputBase} min-h-[60px] resize-y py-2.5`}
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
            href="/jefe/tarifas"
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
