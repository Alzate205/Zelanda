'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff } from 'lucide-react';
import { enviarSalida } from '@/lib/offline/api-cliente';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatearMiles, normalizarEntradaNumerica } from '@/lib/formatos';

type Tipo = 'VENTA' | 'CONSUMO' | 'PERDIDA' | 'OTRO';
type Cliente = { id: string; nombre: string };

export function FormularioSalida({
  stockMax,
  clientes = [],
}: {
  stockMax: number;
  clientes?: Cliente[];
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<Tipo>('VENTA');
  const [cantidad, setCantidad] = useState('');
  const [cliente, setCliente] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [modoCliente, setModoCliente] = useState<'existente' | 'nuevo'>(
    clientes.length > 0 ? 'existente' : 'nuevo'
  );
  const [precio, setPrecio] = useState('');
  const [notas, setNotas] = useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const c = Number(cantidad);
    if (!Number.isFinite(c) || c <= 0) {
      setError('Cantidad debe ser positiva.');
      return;
    }
    if (c > stockMax) {
      setError(`Stock insuficiente. Disponible: ${stockMax.toFixed(2)} kg`);
      return;
    }

    const usaIdExistente = tipo === 'VENTA' && modoCliente === 'existente' && clienteId !== '';
    const clienteFinal = usaIdExistente ? null : cliente.trim() || null;
    const clienteIdFinal = usaIdExistente ? clienteId : null;
    if (tipo === 'VENTA' && !clienteFinal && !clienteIdFinal) {
      setError('Para ventas, elegí o escribí el cliente.');
      return;
    }

    let precioFinal: number | null = null;
    if (tipo === 'VENTA') {
      if (!precio.trim()) {
        setError('Para ventas, el precio total es obligatorio.');
        return;
      }
      const p = Number(precio.replace(/\./g, ''));
      if (!Number.isFinite(p) || p <= 0) {
        setError('Precio total debe ser mayor a 0.');
        return;
      }
      precioFinal = p;
    }

    startTransition(async () => {
      const r = await enviarSalida({
        tipo,
        cantidad_kg: c,
        cliente_detalle: clienteFinal,
        cliente_id: clienteIdFinal,
        precio_total: precioFinal,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push('/almacen/salidas');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">Tipo</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['VENTA', 'CONSUMO', 'PERDIDA', 'OTRO'] as const).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                tipo === t
                  ? 'border-zelanda-verde-700 bg-zelanda-verde-700 text-white'
                  : 'border-zelanda-beige-300'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="sr-only"
              />
              {t === 'VENTA'
                ? 'Venta'
                : t === 'CONSUMO'
                ? 'Consumo'
                : t === 'PERDIDA'
                ? 'Pérdida'
                : 'Otro'}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="cantidad" className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad (kg)
        </label>
        <input
          id="cantidad"
          type="number"
          inputMode="decimal"
          min="0.01"
          max={stockMax}
          step="0.01"
          required
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      {tipo === 'VENTA' && (
        <>
          <div>
            <p className="block text-sm font-medium text-zelanda-verde-900">Cliente</p>
            {clientes.length > 0 ? (
              <div className="mt-1 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
                <button
                  type="button"
                  onClick={() => setModoCliente('existente')}
                  className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                    modoCliente === 'existente'
                      ? 'bg-white text-zelanda-verde-900 shadow-suave'
                      : 'text-zelanda-verde-700'
                  }`}
                >
                  Ya registrado
                </button>
                <button
                  type="button"
                  onClick={() => setModoCliente('nuevo')}
                  className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                    modoCliente === 'nuevo'
                      ? 'bg-white text-zelanda-verde-900 shadow-suave'
                      : 'text-zelanda-verde-700'
                  }`}
                >
                  Texto libre
                </button>
              </div>
            ) : null}
            {clientes.length > 0 && modoCliente === 'existente' ? (
              <select
                required
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="mt-2 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
              >
                <option value="">Selecciona cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="cliente"
                required={modoCliente === 'nuevo'}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre exportador / comprador"
                className="mt-2 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
              />
            )}
          </div>
          <div>
            <label htmlFor="precio" className="block text-sm font-medium text-zelanda-verde-900">
              Precio total (COP){tipo === 'VENTA' ? ' *' : ' (opcional)'}
            </label>
            <input
              id="precio"
              type="text"
              inputMode="numeric"
              value={formatearMiles(precio)}
              onChange={(e) => setPrecio(normalizarEntradaNumerica(e.target.value))}
              placeholder="2.500.000"
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            />
          </div>
        </>
      )}

      {tipo !== 'VENTA' && (
        <div>
          <label htmlFor="detalle" className="block text-sm font-medium text-zelanda-verde-900">
            Detalle (opcional)
          </label>
          <input
            id="detalle"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="ej: consumo casa principal"
            className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          />
        </div>
      )}

      <div>
        <label htmlFor="notas" className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          id="notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la salida se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pendiente ? 'Registrando...' : 'Registrar salida'}
      </button>
    </form>
  );
}
