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
  if (texto.includes('arranque de la app') || texto.includes('no se pudo registrar')) {
    // Pasó de verdad: la app quedó instalada desde un enlace de prueba de
    // Vercel, que pide iniciar sesión y por eso responde el sw.js con una
    // redirección. Un worker que redirige no se registra nunca, así que la
    // parte offline y los avisos no arrancan. Mostrar la dirección es lo que
    // permite darse cuenta sin tener que adivinar.
    return (
      `El motor de la app no arrancó en ${location.host}. ` +
      'Si esa no es la dirección de siempre, la app quedó instalada desde un enlace ' +
      'de prueba: borrala de la pantalla de inicio e instalala de nuevo desde la buena.'
    );
  }
  if (texto.includes('registro en el servidor')) {
    return 'El permiso quedó dado pero no se pudo guardar en el servidor. Probá de nuevo con señal.';
  }
  if (esIPhone() && !estaInstalada()) {
    return 'En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio.';
  }
  if (e instanceof Error && e.name === 'AbortError') {
    return (
      'El servicio de avisos de Apple rechazó el registro. Revisá en el celular: ' +
      'que el Modo de bajo consumo esté apagado, que haya internet estable, y en ' +
      'Ajustes → Notificaciones que La Zelanda tenga los avisos permitidos. ' +
      'Después probá de nuevo.'
    );
  }
  const nombre = e instanceof Error && e.name && e.name !== 'Error' ? `${e.name}: ` : '';
  return `El celular rechazó la suscripción en ${location.host}. Mostrale esto al jefe: ${nombre}${texto}`;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Plana = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Plana);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Devuelve el worker activo, registrándolo si hace falta.
 *
 * Esperar a `serviceWorker.ready` a secas no distingue entre "todavía está
 * arrancando" y "nunca se va a registrar", y lo segundo pasa cuando el sw.js
 * responde con una redirección. Registrar acá mismo, además, recupera el caso
 * de que el registro de la carga inicial se haya caído por un corte de red.
 */
async function obtenerRegistro(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration();
  if (existente?.active) return existente;
  if (!existente) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      throw new Error(`no se pudo registrar: ${detalle}`);
    }
  }
  return conTope(navigator.serviceWorker.ready, 10000, 'arranque de la app');
}

function mismaClave(sub: PushSubscription, clave: Uint8Array): boolean {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return false;
  const bytes = new Uint8Array(actual as ArrayBuffer);
  return bytes.length === clave.length && bytes.every((b, i) => b === clave[i]);
}

/**
 * Consigue la suscripción push, reusando la que ya haya si sirve.
 *
 * Antes se daba de baja la vieja y se creaba otra siempre. En iPhone eso es
 * justo lo que falla: dar de baja y volver a suscribir enseguida hace que el
 * servicio de Apple conteste "internal service error". Solo se da de baja si
 * la clave cambió, que es el único caso en que la vieja de verdad no sirve.
 */
async function suscribir(
  reg: ServiceWorkerRegistration,
  claveTexto: string,
  claveBytes: Uint8Array
): Promise<PushSubscription> {
  const vieja = await reg.pushManager.getSubscription();
  if (vieja) {
    if (mismaClave(vieja, claveBytes)) return vieja;
    try {
      await vieja.unsubscribe();
    } catch {
      /* si no deja darla de baja, igual intentamos suscribir */
    }
  }

  // La especificación acepta la clave como texto base64url o como bytes, y
  // Safari no trata las dos formas igual: con los bytes devuelve
  // "AbortError: Failed due to internal service error". Se prueba primero el
  // texto, que es lo que mejor le sienta, y los bytes quedan de respaldo para
  // los navegadores que solo entienden esa forma.
  const formas: (string | Uint8Array)[] = [claveTexto, claveBytes];

  let ultimo: unknown = null;
  for (const forma of formas) {
    for (const intento of [1, 2]) {
      try {
        return await conTope(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: forma as unknown as BufferSource,
          }),
          15000,
          'suscripción'
        );
      } catch (e) {
        ultimo = e;
        // El servicio de Apple falla de a ratos: un segundo intento con la
        // misma forma sale gratis antes de cambiar de estrategia.
        if (intento === 1) await new Promise((listo) => setTimeout(listo, 1500));
      }
    }
  }
  throw ultimo;
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
      const reg = await obtenerRegistro();
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        console.warn('VAPID public key faltante');
        setAviso('No se pudo activar. Avisale al jefe de la finca.');
        return;
      }
      const sub = await suscribir(reg, pub, urlBase64ToUint8Array(pub));
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
