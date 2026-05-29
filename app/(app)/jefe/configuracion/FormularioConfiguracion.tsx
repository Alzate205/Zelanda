'use client';

import { useActionState } from 'react';
import { guardarConfiguracion, type EstadoConfig } from './acciones';
import { formatearMiles } from '@/lib/formatos';
import type { TipoPeriodoPago } from '@prisma/client';

type Props = {
  config: {
    finca_nombre: string;
    finca_telefono: string | null;
    finca_correo: string | null;
    canasta_kg_default: number;
    alerta_dias_anticipacion: number;
    despacho_hora_corte: string;
    insumo_stock_minimo_default: number;
    jornal_tarifa_default: number | null;
    fijo_salario_default: number | null;
    fijo_periodo_pago_default: TipoPeriodoPago | null;
  };
};

const inputClase =
  'mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelClase = 'block text-sm font-medium text-zelanda-verde-900';

export function FormularioConfiguracion({ config }: Props) {
  const [estado, accion, pending] = useActionState<EstadoConfig, FormData>(guardarConfiguracion, {
    error: null,
  });

  return (
    <form action={accion} className="space-y-5">
      {estado.error && (
        <p className="rounded-xl bg-estado-vencida/10 px-4 py-3 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      {/* Sección: Finca */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Datos de la finca</h2>
        <div>
          <label htmlFor="finca_nombre" className={labelClase}>
            Nombre oficial
          </label>
          <input
            id="finca_nombre"
            name="finca_nombre"
            type="text"
            required
            defaultValue={config.finca_nombre}
            className={inputClase}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="finca_telefono" className={labelClase}>
              Teléfono
            </label>
            <input
              id="finca_telefono"
              name="finca_telefono"
              type="tel"
              defaultValue={config.finca_telefono ?? ''}
              className={inputClase}
            />
          </div>
          <div>
            <label htmlFor="finca_correo" className={labelClase}>
              Correo
            </label>
            <input
              id="finca_correo"
              name="finca_correo"
              type="email"
              defaultValue={config.finca_correo ?? ''}
              className={inputClase}
            />
          </div>
        </div>
      </section>

      {/* Sección: Cosecha */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Cosecha</h2>
        <div>
          <label htmlFor="canasta_kg_default" className={labelClase}>
            Capacidad por canasta (kg)
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            Se usa para calcular el peso al registrar cosecha por canastas.
          </p>
          <input
            id="canasta_kg_default"
            name="canasta_kg_default"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            defaultValue={config.canasta_kg_default}
            className={inputClase}
          />
        </div>
      </section>

      {/* Sección: Alertas y Bodega */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Alertas y Bodega</h2>
        <div>
          <label htmlFor="alerta_dias_anticipacion" className={labelClase}>
            Días de anticipación para alertas de tareas
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            Cuántos días antes del vencimiento se muestra la tarea como &quot;próxima&quot;.
          </p>
          <input
            id="alerta_dias_anticipacion"
            name="alerta_dias_anticipacion"
            type="number"
            inputMode="numeric"
            min="1"
            max="60"
            required
            defaultValue={config.alerta_dias_anticipacion}
            className={inputClase}
          />
        </div>
        <div>
          <label htmlFor="despacho_hora_corte" className={labelClase}>
            Hora de corte de despachos (HH:MM)
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            A partir de esta hora se alerta sobre despachos abiertos sin cerrar.
          </p>
          <input
            id="despacho_hora_corte"
            name="despacho_hora_corte"
            type="time"
            required
            defaultValue={config.despacho_hora_corte}
            className={inputClase}
          />
        </div>
        <div>
          <label htmlFor="insumo_stock_minimo_default" className={labelClase}>
            Stock mínimo por defecto (al crear insumos)
          </label>
          <input
            id="insumo_stock_minimo_default"
            name="insumo_stock_minimo_default"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            required
            defaultValue={config.insumo_stock_minimo_default}
            className={inputClase}
          />
        </div>
      </section>

      {/* Sección: Financiero */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Financiero</h2>
        <p className="text-[11.5px] text-zelanda-verde-700">
          Estos valores pre-rellenan los campos al crear trabajadores nuevos. No son obligatorios.
        </p>
        <div>
          <label htmlFor="jornal_tarifa_default" className={labelClase}>
            Tarifa jornal por defecto (COP)
          </label>
          <input
            id="jornal_tarifa_default"
            name="jornal_tarifa_default"
            type="text"
            inputMode="numeric"
            defaultValue={
              config.jornal_tarifa_default != null
                ? formatearMiles(config.jornal_tarifa_default.toString())
                : ''
            }
            placeholder="Ej. 50.000"
            className={inputClase}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fijo_salario_default" className={labelClase}>
              Salario base FIJO por defecto (COP)
            </label>
            <input
              id="fijo_salario_default"
              name="fijo_salario_default"
              type="text"
              inputMode="numeric"
              defaultValue={
                config.fijo_salario_default != null
                  ? formatearMiles(config.fijo_salario_default.toString())
                  : ''
              }
              placeholder="Ej. 1.500.000"
              className={inputClase}
            />
          </div>
          <div>
            <label htmlFor="fijo_periodo_pago_default" className={labelClase}>
              Período por defecto
            </label>
            <select
              id="fijo_periodo_pago_default"
              name="fijo_periodo_pago_default"
              defaultValue={config.fijo_periodo_pago_default ?? ''}
              className={inputClase}
            >
              <option value="">— Sin default —</option>
              <option value="MENSUAL">Mensual</option>
              <option value="QUINCENAL">Quincenal</option>
              <option value="SEMANAL">Semanal</option>
            </select>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-touch rounded-xl bg-zelanda-verde-700 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900)]"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
