'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { suscribirPush } from '../../app/(app)/_acciones/push';
import {
  activarPush,
  conTope,
  esIPhone,
  estaInstalada,
  motivo,
  obtenerRegistro,
  retrato,
  soportaPush,
} from '../../lib/push/cliente';

const POSPONER_KEY = 'push-postponed-until';
const POSPONER_DIAS = 7;

export function PushPrompt() {
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [faltaInstalar, setFaltaInstalar] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  // El worker se deja listo desde el montaje, no al tocar el botón: en iPhone
  // hay que llegar a subscribe() sin esperas de por medio o el gesto vence.
  const registro = useRef<Promise<ServiceWorkerRegistration> | null>(null);

  useEffect(() => {
    if (!soportaPush()) return;
    if (Notification.permission !== 'default') return;
    const pospuesto = localStorage.getItem(POSPONER_KEY);
    if (pospuesto && Number(pospuesto) > Date.now()) return;
    registro.current = obtenerRegistro();
    // Sin esto, un worker que no arranca deja un rechazo sin dueño en la
    // consola; el fallo se cuenta igual cuando se toca "Activar".
    registro.current.catch(() => undefined);
    setFaltaInstalar(esIPhone() && !estaInstalada());
    setMostrar(true);
  }, []);

  const activar = async () => {
    setEnviando(true);
    setAviso(null);
    setDetalle(null);
    try {
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        console.warn('VAPID public key faltante');
        setAviso('No se pudo activar. Avisale al jefe de la finca.');
        return;
      }
      const reg = await (registro.current ?? obtenerRegistro());
      const sub = await activarPush(reg, pub);
      if (!sub) {
        setMostrar(false);
        return;
      }
      const json = sub.toJSON();
      const fd = new FormData();
      fd.set('endpoint', sub.endpoint);
      fd.set('p256dh', json.keys?.p256dh ?? '');
      fd.set('auth', json.keys?.auth ?? '');
      fd.set('userAgent', navigator.userAgent);
      await conTope(suscribirPush(fd), 15000, 'registro en el servidor');
      setMostrar(false);
    } catch (e) {
      console.warn('Suscripción push falló', e);
      // Antes decía "probá con mejor señal" pasara lo que pasara, y eso mandaba
      // a buscar el problema donde no estaba. Ahora nombra el paso que falló.
      setAviso(motivo(e));
      setDetalle(await retrato().catch(() => null));
    } finally {
      setEnviando(false);
    }
  };

  const posponer = () => {
    localStorage.setItem(POSPONER_KEY, String(Date.now() + POSPONER_DIAS * 24 * 60 * 60 * 1000));
    setMostrar(false);
  };

  if (!mostrar) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-screen-md px-3 pb-2">
      <div className="rounded-xl border border-zelanda-beige-300 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-zelanda-verde-700/10 p-2 text-zelanda-verde-800">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-zelanda-verde-900">Activar notificaciones</p>
            <p className="mt-1 text-xs text-zelanda-verde-700/80">
              {faltaInstalar
                ? 'En iPhone hace falta instalar la app primero: tocá Compartir y luego “Agregar a inicio”. Después abrila desde el icono y activá los avisos ahí.'
                : 'Enterate de asignaciones, novedades y vencidas aunque no tengas la app abierta.'}
            </p>
            {aviso ? (
              <p role="status" className="mt-2 text-xs text-estado-vencida">
                {aviso}
              </p>
            ) : null}
            {detalle ? (
              <p className="mt-1 select-all text-[11px] leading-snug text-zelanda-verde-700/70">
                {detalle}
              </p>
            ) : null}
            {aviso ? (
              <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
                También podés volver a intentarlo desde Mi Perfil.
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              {faltaInstalar ? null : (
                <button
                  type="button"
                  onClick={activar}
                  disabled={enviando}
                  className="min-h-touch rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {enviando ? 'Activando...' : 'Activar'}
                </button>
              )}
              <button
                type="button"
                onClick={posponer}
                disabled={enviando}
                className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm text-zelanda-verde-700"
              >
                {faltaInstalar ? 'Entendido' : 'Más tarde'}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={posponer}
            aria-label="Cerrar"
            className="text-zelanda-verde-700/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
