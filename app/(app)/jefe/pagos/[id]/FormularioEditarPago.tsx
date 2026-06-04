'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { editarPago, type EstadoPago } from '../acciones';
import { formatearMiles, normalizarEntradaNumerica } from '@/lib/formatos';

const ESTADO_INICIAL: EstadoPago = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

type Tipo = 'SALARIO' | 'ADELANTO' | 'JORNAL' | 'SERVICIO' | 'BONO' | 'AJUSTE' | 'OTRO';
const TIPOS: { id: Tipo; etiqueta: string }[] = [
  { id: 'SALARIO', etiqueta: 'Salario' },
  { id: 'JORNAL', etiqueta: 'Jornal' },
  { id: 'SERVICIO', etiqueta: 'Servicio' },
  { id: 'BONO', etiqueta: 'Bono' },
  { id: 'ADELANTO', etiqueta: 'Adelanto' },
  { id: 'AJUSTE', etiqueta: 'Ajuste' },
  { id: 'OTRO', etiqueta: 'Otro' },
];

export function FormularioEditarPago({
  id,
  nombrePersona,
  tipoInicial,
  montoInicial,
  fechaInicial,
  metodoPagoInicial,
  cubreDesdeInicial,
  cubreHastaInicial,
  motivoDiferenciaInicial,
  notasIniciales,
  servicioIdInicial,
  servicios,
}: {
  id: string;
  nombrePersona: string;
  tipoInicial: Tipo;
  montoInicial: number;
  fechaInicial: string;
  metodoPagoInicial: string;
  cubreDesdeInicial: string;
  cubreHastaInicial: string;
  motivoDiferenciaInicial: string;
  notasIniciales: string;
  servicioIdInicial: string;
  servicios: { id: string; descripcion: string; persona_nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(editarPago, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [monto, setMonto] = useState(montoInicial > 0 ? String(montoInicial) : '');
  const [fecha, setFecha] = useState(fechaInicial);
  const [metodoPago, setMetodoPago] = useState(metodoPagoInicial);
  const [cubreDesde, setCubreDesde] = useState(cubreDesdeInicial);
  const [cubreHasta, setCubreHasta] = useState(cubreHastaInicial);
  const [motivoDiferencia, setMotivoDiferencia] = useState(motivoDiferenciaInicial);
  const [notas, setNotas] = useState(notasIniciales);
  const [servicioId, setServicioId] = useState(servicioIdInicial);
  const conPeriodo = cubreDesde !== '' || cubreHasta !== '';

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <input type="hidden" name="id" value={id} />

      <Link
        href="/jefe/pagos"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Pagos
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar pago
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{nombrePersona}</h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="tipo" className={labelBase}>
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            className={inputBase}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
          >
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>

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
            className={inputBase}
            value={formatearMiles(monto)}
            onChange={(e) => setMonto(normalizarEntradaNumerica(e.target.value, tipo === 'AJUSTE'))}
            placeholder="500.000"
          />
        </div>

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
          <label htmlFor="metodo_pago" className={labelBase}>
            Método (opcional)
          </label>
          <input
            id="metodo_pago"
            name="metodo_pago"
            type="text"
            className={inputBase}
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            placeholder="Efectivo, transferencia…"
          />
        </div>

        {tipo === 'SERVICIO' ? (
          <div>
            <label htmlFor="servicio_id" className={labelBase}>
              Contrato
            </label>
            <select
              id="servicio_id"
              name="servicio_id"
              className={inputBase}
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
            >
              <option value="">Sin contrato asociado</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.persona_nombre} — {s.descripcion}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="con_periodo"
            checked={conPeriodo}
            onChange={(e) => {
              if (!e.target.checked) {
                setCubreDesde('');
                setCubreHasta('');
              }
            }}
            className="h-4 w-4 rounded border-zelanda-beige-300"
          />
          <label htmlFor="con_periodo" className="text-sm text-zelanda-verde-800">
            Indicar periodo cubierto
          </label>
        </div>

        {conPeriodo ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cubre_desde" className={labelBase}>
                Desde
              </label>
              <input
                id="cubre_desde"
                name="cubre_desde"
                type="date"
                className={inputBase}
                value={cubreDesde}
                onChange={(e) => setCubreDesde(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="cubre_hasta" className={labelBase}>
                Hasta
              </label>
              <input
                id="cubre_hasta"
                name="cubre_hasta"
                type="date"
                className={inputBase}
                value={cubreHasta}
                onChange={(e) => setCubreHasta(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {tipo === 'AJUSTE' ? (
          <div>
            <label htmlFor="motivo_diferencia" className={labelBase}>
              Motivo del ajuste *
            </label>
            <input
              id="motivo_diferencia"
              name="motivo_diferencia"
              type="text"
              required
              className={inputBase}
              value={motivoDiferencia}
              onChange={(e) => setMotivoDiferencia(e.target.value)}
              placeholder="Explicá por qué hay un ajuste"
            />
          </div>
        ) : null}

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
