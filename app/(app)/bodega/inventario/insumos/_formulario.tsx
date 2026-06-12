'use client';

import { useActionState } from 'react';
import { crearInsumo, actualizarInsumo, type EstadoEdicion } from '../acciones';

type Valores = {
  id?: string;
  nombre: string;
  categoria: 'CULTIVO' | 'COSECHA' | 'APICULTURA';
  unidad: string;
  stock_minimo: string;
  costo_unitario: string | null;
  ingrediente_activo: string | null;
  registro_ica: string | null;
  periodo_carencia_dias: string | null;
  periodo_reingreso_horas: string | null;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioInsumo({
  modo,
  valores,
  stockMinimoDefault,
}: {
  modo: 'crear' | 'editar';
  valores?: Valores;
  stockMinimoDefault?: number;
}) {
  const accion = modo === 'crear' ? crearInsumo : actualizarInsumo;
  const [estado, formAction, pending] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-4">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}

      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={valores?.nombre ?? ''}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <div>
        <label htmlFor="categoria" className="block text-sm font-medium text-zelanda-verde-900">
          Categoría
        </label>
        <select
          id="categoria"
          name="categoria"
          required
          defaultValue={valores?.categoria ?? 'CULTIVO'}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        >
          <option value="CULTIVO">Cultivo</option>
          <option value="COSECHA">Cosecha</option>
          <option value="APICULTURA">Apicultura</option>
        </select>
      </div>

      <div>
        <label htmlFor="unidad" className="block text-sm font-medium text-zelanda-verde-900">
          Unidad
        </label>
        <input
          id="unidad"
          name="unidad"
          required
          placeholder="L, kg, unidades, m..."
          defaultValue={valores?.unidad ?? ''}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <div>
        <label htmlFor="stock_minimo" className="block text-sm font-medium text-zelanda-verde-900">
          Stock mínimo
        </label>
        <input
          id="stock_minimo"
          name="stock_minimo"
          type="number"
          min="0"
          step="0.001"
          required
          defaultValue={
            valores?.stock_minimo ?? (stockMinimoDefault != null ? String(stockMinimoDefault) : '0')
          }
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <div>
        <label
          htmlFor="costo_unitario"
          className="block text-sm font-medium text-zelanda-verde-900"
        >
          Costo unitario (opcional)
        </label>
        <input
          id="costo_unitario"
          name="costo_unitario"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={valores?.costo_unitario ?? ''}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      <fieldset className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50/60 p-3">
        <legend className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
          Ficha técnica (químicos) — opcional
        </legend>
        <div>
          <label
            htmlFor="ingrediente_activo"
            className="block text-sm font-medium text-zelanda-verde-900"
          >
            Ingrediente activo
          </label>
          <input
            id="ingrediente_activo"
            name="ingrediente_activo"
            placeholder="Ej: Glifosato 480 g/L"
            defaultValue={valores?.ingrediente_activo ?? ''}
            className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          />
        </div>
        <div>
          <label
            htmlFor="registro_ica"
            className="block text-sm font-medium text-zelanda-verde-900"
          >
            Registro ICA
          </label>
          <input
            id="registro_ica"
            name="registro_ica"
            defaultValue={valores?.registro_ica ?? ''}
            className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="periodo_carencia_dias"
              className="block text-sm font-medium text-zelanda-verde-900"
            >
              Carencia (días)
            </label>
            <input
              id="periodo_carencia_dias"
              name="periodo_carencia_dias"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue={valores?.periodo_carencia_dias ?? ''}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            />
          </div>
          <div>
            <label
              htmlFor="periodo_reingreso_horas"
              className="block text-sm font-medium text-zelanda-verde-900"
            >
              Reingreso (horas)
            </label>
            <input
              id="periodo_reingreso_horas"
              name="periodo_reingreso_horas"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue={valores?.periodo_reingreso_horas ?? ''}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            />
          </div>
        </div>
        <p className="m-0 text-[10.5px] text-zelanda-verde-700">
          Días sin cosechar / horas sin entrar al lote después de aplicar, según la etiqueta del
          producto.
        </p>
      </fieldset>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pending ? 'Guardando...' : modo === 'crear' ? 'Crear' : 'Guardar'}
      </button>
    </form>
  );
}
