'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Info } from 'lucide-react';
import { editarCompra, type EstadoCompra } from '../../acciones';

const ESTADO_INICIAL: EstadoCompra = { error: null };

const inputBase =
  'mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelBase =
  'block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';

type Proveedor = { id: string; nombre: string };

export function FormularioEditarCompra({
  id,
  proveedorIdInicial,
  proveedorNombreInicial,
  fechaIso,
  numeroFacturaInicial,
  notasIniciales,
  proveedores,
}: {
  id: string;
  proveedorIdInicial: string;
  proveedorNombreInicial: string;
  fechaIso: string;
  numeroFacturaInicial: string;
  notasIniciales: string;
  proveedores: Proveedor[];
}) {
  const [estado, accion, pendiente] = useActionState(editarCompra, ESTADO_INICIAL);

  // Si la compra tiene un proveedor_id reconocido entre los activos, mostramos "existente";
  // si no (proveedor_detalle texto libre, o proveedor inactivo), mostramos "nuevo" pre-llenado.
  const proveedorEnLista = proveedores.some((p) => p.id === proveedorIdInicial);
  const [modoProveedor, setModoProveedor] = useState<'existente' | 'nuevo'>(
    proveedorEnLista ? 'existente' : 'nuevo'
  );
  const [proveedorId, setProveedorId] = useState(proveedorEnLista ? proveedorIdInicial : '');
  const [proveedorNuevo, setProveedorNuevo] = useState(
    proveedorEnLista ? '' : proveedorNombreInicial
  );
  const [fecha, setFecha] = useState(fechaIso);
  const [numeroFactura, setNumeroFactura] = useState(numeroFacturaInicial);
  const [notas, setNotas] = useState(notasIniciales);

  return (
    <form action={accion} className="space-y-5 pb-28" noValidate>
      <input type="hidden" name="id" value={id} />
      {modoProveedor === 'existente' ? (
        <input type="hidden" name="proveedor_id" value={proveedorId} />
      ) : (
        <input type="hidden" name="proveedor_nuevo_nombre" value={proveedorNuevo} />
      )}

      <Link
        href={`/jefe/compras/${id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Compra
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Editar</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Editar compra</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Solo se editan los datos de cabecera.
        </p>
      </header>

      {/* Aviso: los items no se editan acá */}
      <div className="flex items-start gap-2.5 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zelanda-verde-700" />
        <p className="text-[12.5px] text-zelanda-verde-800">
          Para cambiar los insumos de la compra, anulá esta compra y creá una nueva.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        {/* Selector de proveedor */}
        <div>
          <label className={labelBase}>Proveedor</label>
          <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <button
              type="button"
              onClick={() => setModoProveedor('existente')}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                modoProveedor === 'existente'
                  ? 'bg-white text-zelanda-verde-900 shadow-suave'
                  : 'text-zelanda-verde-700'
              }`}
            >
              Ya registrado
            </button>
            <button
              type="button"
              onClick={() => setModoProveedor('nuevo')}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                modoProveedor === 'nuevo'
                  ? 'bg-white text-zelanda-verde-900 shadow-suave'
                  : 'text-zelanda-verde-700'
              }`}
            >
              Nuevo
            </button>
          </div>

          {modoProveedor === 'existente' ? (
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className={`${inputBase} mt-2`}
            >
              <option value="">Selecciona proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="text"
                value={proveedorNuevo}
                onChange={(e) => setProveedorNuevo(e.target.value)}
                placeholder="Nombre del proveedor"
                className={`${inputBase} mt-2`}
              />
              <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
                Se crea como proveedor activo al guardar.
              </p>
            </>
          )}
        </div>

        {/* Fecha */}
        <div>
          <label htmlFor="fecha" className={labelBase}>
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputBase}
          />
        </div>

        {/* Factura */}
        <div>
          <label htmlFor="numero_factura" className={labelBase}>
            Factura # (opcional)
          </label>
          <input
            id="numero_factura"
            name="numero_factura"
            type="text"
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
            className={inputBase}
          />
        </div>

        {/* Notas */}
        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones generales, condiciones, etc."
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
            href={`/jefe/compras/${id}`}
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
