'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, Check } from 'lucide-react';
import { enviarDespachoCerrar } from '@/lib/offline/api-cliente';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type ItemRow = {
  id: string;
  tipo: 'HERRAMIENTA' | 'INSUMO';
  nombre: string;
  unidad: string;
  cantidad: string;
};

type Condicion = 'buena' | 'usada' | 'danada';

const ETIQUETA_COND: Record<Condicion, string> = {
  buena: 'Buen estado',
  usada: 'Usada',
  danada: 'Dañada',
};

function condicionAString(c: Condicion): string | null {
  if (c === 'buena') return null;
  if (c === 'usada') return 'usada';
  return 'dañada';
}

export function FormularioCierreDespacho({
  despachoId,
  items,
  lotes,
  lotePreseleccionado,
}: {
  despachoId: string;
  items: ItemRow[];
  lotes: { id: string; nombre: string }[];
  lotePreseleccionado: string | null;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [condiciones, setCondiciones] = useState<Record<string, Condicion>>(() => {
    const o: Record<string, Condicion> = {};
    for (const it of items) {
      if (it.tipo === 'HERRAMIENTA') o[it.id] = 'buena';
    }
    return o;
  });

  const [consumos, setConsumos] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const it of items) {
      if (it.tipo === 'INSUMO') o[it.id] = Number(it.cantidad);
    }
    return o;
  });

  const [observaciones, setObservaciones] = useState('');
  const [loteId, setLoteId] = useState<string>(lotePreseleccionado ?? '');

  const herramientas = items.filter((it) => it.tipo === 'HERRAMIENTA');
  const insumos = items.filter((it) => it.tipo === 'INSUMO');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload: Array<{
      despacho_item_id: string;
      tipo: 'HERRAMIENTA' | 'INSUMO';
      devuelto?: boolean;
      consumido?: number;
      condicion_devolucion?: string | null;
    }> = [];

    for (const it of items) {
      if (it.tipo === 'HERRAMIENTA') {
        const c = condiciones[it.id] ?? 'buena';
        const partes: string[] = [];
        const cond = condicionAString(c);
        if (cond) partes.push(cond);
        if (observaciones.trim()) partes.push(observaciones.trim());
        payload.push({
          despacho_item_id: it.id,
          tipo: 'HERRAMIENTA',
          devuelto: true,
          condicion_devolucion: partes.length > 0 ? partes.join(' · ') : null,
        });
      } else {
        const consumido = consumos[it.id] ?? 0;
        const original = Number(it.cantidad);
        if (!Number.isFinite(consumido) || consumido < 0) {
          setError('Cantidad consumida inválida en un item.');
          return;
        }
        if (consumido > original) {
          setError('La cantidad consumida no puede ser mayor a la despachada.');
          return;
        }
        payload.push({
          despacho_item_id: it.id,
          tipo: 'INSUMO',
          consumido,
        });
      }
    }

    startTransition(async () => {
      const r = await enviarDespachoCerrar({
        despacho_id: despachoId,
        lote_id: insumos.length > 0 && loteId !== '' ? loteId : null,
        items: payload,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push('/bodega/despachos');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-24" noValidate>
      {herramientas.length > 0 ? (
        <section>
          <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Devolución de herramientas
          </p>
          <div className="flex flex-col gap-2">
            {herramientas.map((it) => (
              <FilaCondicion
                key={it.id}
                nombre={`${it.nombre}${Number(it.cantidad) > 1 ? ` × ${it.cantidad}` : ''}`}
                valor={condiciones[it.id] ?? 'buena'}
                onChange={(v) => setCondiciones((p) => ({ ...p, [it.id]: v }))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {insumos.length > 0 ? (
        <section>
          <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Consumo real de insumos
          </p>
          <div className="flex flex-col gap-2">
            {insumos.map((it) => (
              <FilaConsumo
                key={it.id}
                nombre={it.nombre}
                despachado={Number(it.cantidad)}
                unidad={it.unidad}
                valor={consumos[it.id] ?? 0}
                onChange={(v) => setConsumos((p) => ({ ...p, [it.id]: v }))}
              />
            ))}
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
              ¿En qué lote se aplicó?
            </label>
            <select
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
              className="block w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2.5 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            >
              <option value="">Sin lote (bodega / apiario / general)</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10.5px] text-zelanda-verde-700">
              Queda en el registro de aplicaciones del lote (trazabilidad).
            </p>
          </div>
        </section>
      ) : null}

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
          Observaciones del cierre
        </label>
        <textarea
          rows={3}
          placeholder="Ej. quedaron restos de insecticida en el tanque; lavada antes de guardar."
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="block min-h-[76px] w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2.5 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      {!online ? (
        <p className="flex items-center gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — el cierre se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[10px] bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pendiente}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Check className="h-[18px] w-[18px]" />
            {pendiente ? 'Cerrando…' : 'Cerrar despacho'}
          </button>
        </div>
      </div>
    </form>
  );
}

function FilaCondicion({
  nombre,
  valor,
  onChange,
}: {
  nombre: string;
  valor: Condicion;
  onChange: (v: Condicion) => void;
}) {
  const opciones: Condicion[] = ['buena', 'usada', 'danada'];
  return (
    <div className="rounded-xl border border-zelanda-beige-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 font-serif text-[14px] text-zelanda-verde-900">{nombre}</p>
        <span className="text-[10.5px] text-zelanda-verde-700">salida: Buen estado</span>
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
        {opciones.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange(op)}
            className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition ${
              valor === op
                ? op === 'danada'
                  ? 'bg-[#f4dad7] text-[#7b2a23] shadow-suave'
                  : op === 'usada'
                  ? 'bg-[#fbf3df] text-zelanda-ocre-700 shadow-suave'
                  : 'bg-white text-zelanda-verde-900 shadow-suave'
                : 'text-zelanda-verde-700 hover:text-zelanda-verde-900'
            }`}
          >
            {ETIQUETA_COND[op]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilaConsumo({
  nombre,
  despachado,
  unidad,
  valor,
  onChange,
}: {
  nombre: string;
  despachado: number;
  unidad: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  const pct = despachado > 0 ? Math.min(100, (valor / despachado) * 100) : 0;
  const paso = unidad.toLowerCase().includes('kg') || unidad.toLowerCase() === 'l' ? 0.1 : 1;

  function inc(delta: number) {
    const nuevo = Math.max(0, Math.min(despachado, valor + delta));
    const redondeado = Math.round(nuevo * 1000) / 1000;
    onChange(redondeado);
  }

  return (
    <div className="rounded-xl border border-zelanda-beige-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 font-serif text-[14px] text-zelanda-verde-900">{nombre}</p>
        <span className="text-[10.5px] text-zelanda-verde-700">
          despachado: {despachado} {unidad}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-[10px] border border-zelanda-verde-300">
          <button
            type="button"
            onClick={() => inc(-paso)}
            className="flex h-9 w-9 items-center justify-center bg-white text-[18px] text-zelanda-verde-800 hover:bg-zelanda-beige-50"
            aria-label="Restar"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={despachado}
            step={paso}
            value={valor}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.max(0, Math.min(despachado, n)));
            }}
            className="h-9 w-[60px] border-x border-zelanda-verde-200 bg-white px-1 text-center font-serif text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          />
          <button
            type="button"
            onClick={() => inc(paso)}
            className="flex h-9 w-9 items-center justify-center bg-white text-[18px] text-zelanda-verde-800 hover:bg-zelanda-beige-50"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
        <span className="text-[12px] text-zelanda-verde-700">{unidad}</span>
        <span className="ml-auto font-serif text-[13px] text-zelanda-verde-900">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zelanda-beige-200">
        <div
          className="h-full rounded-full bg-zelanda-verde-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px] text-zelanda-verde-700">
        Lo no consumido vuelve al stock disponible.
      </p>
    </div>
  );
}
