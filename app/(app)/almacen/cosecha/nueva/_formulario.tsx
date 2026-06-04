'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, Check } from 'lucide-react';
import { enviarCosecha } from '@/lib/offline/api-cliente';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Segmented } from '@/components/ui/Segmented';
import { pesoCanastas } from '@/lib/comercio';

export function FormularioCosecha({
  personas,
  lotes,
  compacto = false,
  canastaPorDefecto = 0,
}: {
  personas: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
  compacto?: boolean;
  canastaPorDefecto?: number;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [metodo, setMetodo] = useState<'CANASTA' | 'BASCULA'>('CANASTA');
  const [canastas, setCanastas] = useState('');
  const [capacidad, setCapacidad] = useState(
    canastaPorDefecto > 0 ? String(canastaPorDefecto) : ''
  );
  const [peso, setPeso] = useState('');
  const [notas, setNotas] = useState('');

  const pesoCalculado =
    metodo === 'CANASTA' && canastas && capacidad
      ? pesoCanastas(Number(canastas), Number(capacidad))
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!personaId) {
      setError('Selecciona un recolector.');
      return;
    }
    if (!loteId) {
      setError('Selecciona un lote.');
      return;
    }

    let pesoKg: number;
    let cantidadCanastas: number | null = null;
    let capacidadCanastaKg: number | null = null;

    if (metodo === 'CANASTA') {
      const c = Number(canastas);
      const cap = Number(capacidad);
      if (!Number.isInteger(c) || c <= 0) {
        setError('Cantidad de canastas debe ser entero positivo.');
        return;
      }
      if (!Number.isFinite(cap) || cap <= 0) {
        setError('Capacidad de canasta debe ser positiva.');
        return;
      }
      cantidadCanastas = c;
      capacidadCanastaKg = cap;
      pesoKg = c * cap;
    } else {
      const p = Number(peso);
      if (!Number.isFinite(p) || p <= 0) {
        setError('Peso debe ser positivo.');
        return;
      }
      pesoKg = p;
    }

    startTransition(async () => {
      const r = await enviarCosecha({
        persona_id: personaId,
        lote_id: loteId,
        metodo,
        cantidad_canastas: cantidadCanastas,
        capacidad_canasta_kg: capacidadCanastaKg,
        peso_kg: pesoKg,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (compacto) {
        setPersonaId('');
        setLoteId('');
        setCanastas('');
        setCapacidad('');
        setPeso('');
        setNotas('');
        router.refresh();
      } else {
        router.push('/almacen/cosecha');
      }
    });
  }

  const labelClase =
    'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700';
  const inputClase =
    'h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <label className={labelClase}>Método</label>
        <Segmented
          opciones={[
            { id: 'CANASTA', etiqueta: 'Canastas' },
            { id: 'BASCULA', etiqueta: 'Báscula' },
          ]}
          valor={metodo}
          onCambio={setMetodo}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="lote" className={labelClase}>
            Lote
          </label>
          <select
            id="lote"
            required
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className={inputClase}
          >
            <option value="">Selecciona…</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recolector" className={labelClase}>
            Recolector
          </label>
          <select
            id="recolector"
            required
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className={inputClase}
          >
            <option value="">Selecciona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {metodo === 'CANASTA' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="canastas" className={labelClase}>
              Canastas
            </label>
            <input
              id="canastas"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              value={canastas}
              onChange={(e) => setCanastas(e.target.value)}
              className={inputClase}
            />
          </div>
          <div>
            <label htmlFor="capacidad" className={labelClase}>
              Capacidad (kg)
            </label>
            <input
              id="capacidad"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className={inputClase}
            />
          </div>
          {pesoCalculado !== null ? (
            <div className="col-span-2 flex items-center justify-between rounded-[10px] border border-zelanda-verde-200 bg-zelanda-verde-50 px-3 py-2.5">
              <span className="text-xs text-zelanda-verde-700">Total calculado</span>
              <span className="font-serif text-[22px] text-zelanda-verde-900">
                {pesoCalculado.toFixed(0)} kg
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <label htmlFor="peso" className={labelClase}>
            Peso (kg)
          </label>
          <input
            id="peso"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className={inputClase}
          />
        </div>
      )}

      {!compacto ? (
        <div>
          <label htmlFor="notas" className={labelClase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2.5 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          />
        </div>
      ) : null}

      {!online ? (
        <p className="flex items-center gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la cosecha se guardará y subirá al volver la conexión.
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

      <button
        type="submit"
        disabled={pendiente}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        <Check className="h-[18px] w-[18px]" />
        {pendiente ? 'Registrando…' : 'Registrar ingreso'}
      </button>
    </form>
  );
}
