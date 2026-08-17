'use client';

import { useState } from 'react';
import { RefreshCw, Check, AlertTriangle, CloudOff } from 'lucide-react';
import { SyncEngine } from '@/lib/offline/sync';

type Aviso = { tono: 'bien' | 'mal' | 'espera'; texto: string };

const TONOS: Record<Aviso['tono'], string> = {
  bien: 'text-zelanda-verde-800',
  mal: 'text-estado-vencida',
  espera: 'text-zelanda-ocre-700',
};

const ICONOS = {
  bien: Check,
  mal: AlertTriangle,
  espera: CloudOff,
};

/**
 * "Sincronizar ahora" siempre contestaba en silencio: el trabajador lo apretaba,
 * no pasaba nada visible y no había forma de saber si había subido algo, si el
 * servidor lo rechazó o si no había señal. Ahora dice qué pasó.
 */
export function BotonSincronizar() {
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  async function sincronizar() {
    setCorriendo(true);
    setAviso(null);
    try {
      const r = await SyncEngine.procesarCola();
      if (r.sinSenal) {
        setAviso({ tono: 'espera', texto: 'Sin señal. Se sube solo cuando vuelva.' });
      } else if (r.fallidos > 0) {
        setAviso({
          tono: 'mal',
          texto: `${r.fallidos} con error: ${r.ultimoError ?? 'el servidor lo rechazó'}`,
        });
      } else if (r.pendientes > 0) {
        setAviso({
          tono: 'mal',
          texto: `No se pudo ahora (${r.ultimoError ?? 'falló el servidor'}). Sigue pendiente.`,
        });
      } else if (r.subidos > 0) {
        setAviso({
          tono: 'bien',
          texto: `${r.subidos} ${r.subidos === 1 ? 'registro subido' : 'registros subidos'}.`,
        });
      } else {
        setAviso({ tono: 'bien', texto: 'No había nada pendiente.' });
      }
    } catch (e) {
      setAviso({ tono: 'mal', texto: (e as Error).message });
    } finally {
      setCorriendo(false);
    }
  }

  const Icono = aviso ? ICONOS[aviso.tono] : null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={sincronizar}
        disabled={corriendo}
        className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${corriendo ? 'animate-spin' : ''}`} />
        {corriendo ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>

      {aviso && Icono ? (
        <p role="status" className={`flex items-start gap-1.5 text-[12.5px] ${TONOS[aviso.tono]}`}>
          <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{aviso.texto}</span>
        </p>
      ) : null}
    </div>
  );
}
