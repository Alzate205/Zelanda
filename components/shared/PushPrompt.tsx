'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { suscribirPush } from '../../app/(app)/_acciones/push';

const POSPONER_KEY = 'push-postponed-until';
const POSPONER_DIAS = 7;

/**
 * Acota cualquier espera que pueda no terminar nunca.
 *
 * `serviceWorker.ready` no resuelve si el worker no llega a activarse, y en un
 * celular recién instalado eso pasa. Sin tope, el botón se quedaba en
 * "Activando..." para siempre.
 */
function conTope<T>(promesa: Promise<T>, ms: number, que: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout de ${que}`)), ms)),
  ]);
}

/**
 * En iPhone, los avisos push solo funcionan si la app está instalada en la
 * pantalla de inicio. Desde Safari, el navegador deja pedir el permiso pero
 * después rechaza la suscripción, y el aviso quedaba culpando a la señal.
 */
function esIPhone(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

function estaInstalada(): boolean {
  const navegadorIOS = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navegadorIOS.standalone === true
  );
}

/**
 * Traduce el fallo a algo accionable, nombrando el paso que se cayó.
 * El texto crudo va detrás para poder pasarlo si hay que investigar.
 */
function motivo(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes('arranque de la app')) {
    return 'La app no terminó de arrancar. Cerrala del todo, volvé a abrirla y probá de nuevo.';
  }
  if (texto.includes('registro en el servidor')) {
    return 'El permiso quedó dado pero no se pudo guardar en el servidor. Probá de nuevo con señal.';
  }
  if (esIPhone() && !estaInstalada()) {
    return 'En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio.';
  }
  return `El celular rechazó la suscripción. Mostrale esto al jefe: ${texto}`;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Plana = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Plana);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushPrompt() {
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [faltaInstalar, setFaltaInstalar] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('PushManager' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'default') return;
    const pospuesto = localStorage.getItem(POSPONER_KEY);
    if (pospuesto && Number(pospuesto) > Date.now()) return;
    setFaltaInstalar(esIPhone() && !estaInstalada());
    setMostrar(true);
  }, []);

  const activar = async () => {
    setEnviando(true);
    setAviso(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMostrar(false);
        return;
      }
      const reg = await conTope(navigator.serviceWorker.ready, 10000, 'arranque de la app');
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        console.warn('VAPID public key faltante');
        setAviso('No se pudo activar. Avisale al jefe de la finca.');
        return;
      }
      // Una suscripción vieja (de una instalación anterior) puede dejar
      // subscribe() colgado para siempre: se descarta primero, y se acota
      // todo con un timeout para que el botón nunca quede en "Activando...".
      const vieja = await reg.pushManager.getSubscription();
      if (vieja) {
        try {
          await vieja.unsubscribe();
        } catch {
          /* noop */
        }
      }
      const sub = await conTope(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pub) as BufferSource,
        }),
        15000,
        'suscripción'
      );
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
