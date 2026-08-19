'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { suscribirPush, desuscribirPush } from '../../app/(app)/_acciones/push';
import {
  conTope,
  esIPhone,
  estaInstalada,
  motivo,
  obtenerRegistro,
  pasoPendiente,
  pedirPermiso,
  retrato,
  soportaPush,
  suscribirAhora,
} from '../../lib/push/cliente';

type Estado = 'no-soporta' | 'denegado' | 'activo' | 'inactivo' | 'sin-motor' | 'cargando';

/**
 * Interruptor de avisos de Mi Perfil.
 *
 * Es la única puerta que queda cuando el cartel de la home ya no aparece, y eso
 * pasa apenas se toca el permiso una vez: el cartel solo se muestra con el
 * permiso en "default", y en Android el navegador y la app instalada comparten
 * ese permiso. Por eso acá nunca puede quedar una pantalla sin salida: si algo
 * falla, se dice qué falló y se deja un botón para volver a intentar.
 */
export function PushToggle() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  // El worker y la suscripción previa se dejan resueltos de antemano: en iPhone
  // no puede haber ningún await entre el toque y subscribe().
  const registro = useRef<ServiceWorkerRegistration | null>(null);
  const suscripcionPrevia = useRef<PushSubscription | null | undefined>(undefined);
  const [faltaSegundoToque, setFaltaSegundoToque] = useState(false);

  async function refrescar() {
    if (!soportaPush()) {
      setEstado('no-soporta');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstado('denegado');
      return;
    }
    // Antes esto era `await navigator.serviceWorker.ready` a secas. Esa promesa
    // no resuelve nunca si el worker no llega a activarse, y el componente se
    // quedaba mostrando "Cargando..." para siempre: sin botón, sin explicación,
    // sin forma de activar los avisos.
    try {
      const reg = await obtenerRegistro();
      registro.current = reg;
      const sub = await reg.pushManager.getSubscription();
      suscripcionPrevia.current = sub;
      setEstado(sub ? 'activo' : 'inactivo');
    } catch (e) {
      console.warn('No se pudo consultar el estado de los avisos', e);
      setAviso(motivo(e));
      setDetalle(await retrato().catch(() => null));
      setEstado('sin-motor');
    }
  }

  useEffect(() => {
    refrescar();
  }, []);

  async function activar() {
    setAviso(null);
    setDetalle(null);

    // Primer toque: solo el permiso. El diálogo cierra la ventana de activación
    // del toque, así que suscribir acá mismo dejaría la promesa colgada en
    // iPhone. Ver `pasoPendiente` en lib/push/cliente.
    if (pasoPendiente() === 'pedir-permiso') {
      setTrabajando(true);
      try {
        const perm = await pedirPermiso();
        if (perm !== 'granted') {
          await refrescar();
          return;
        }
        setFaltaSegundoToque(true);
      } finally {
        setTrabajando(false);
      }
      return;
    }

    // Segundo toque: suscribir.
    setTrabajando(true);
    try {
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        console.warn('VAPID public key faltante');
        setAviso('No se pudo activar. Avisale al jefe de la finca.');
        return;
      }
      const reg = registro.current ?? (await obtenerRegistro());
      const sub = await suscribirAhora(reg, pub, suscripcionPrevia.current);
      const json = sub.toJSON();
      const fd = new FormData();
      fd.set('endpoint', sub.endpoint);
      fd.set('p256dh', json.keys?.p256dh ?? '');
      fd.set('auth', json.keys?.auth ?? '');
      fd.set('userAgent', navigator.userAgent);
      await conTope(suscribirPush(fd), 15000, 'registro en el servidor');
      suscripcionPrevia.current = sub;
      setFaltaSegundoToque(false);
      setEstado('activo');
    } catch (e) {
      console.warn('Activación push falló', e);
      setAviso(motivo(e));
      setDetalle(await retrato().catch(() => null));
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    setAviso(null);
    setDetalle(null);
    try {
      const reg = registro.current ?? (await obtenerRegistro());
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set('endpoint', sub.endpoint);
        await conTope(desuscribirPush(fd), 15000, 'registro en el servidor');
        await sub.unsubscribe();
      }
      suscripcionPrevia.current = null;
      setEstado('inactivo');
    } catch (e) {
      console.warn('Desactivación push falló', e);
      setAviso(motivo(e));
      setDetalle(await retrato().catch(() => null));
    } finally {
      setTrabajando(false);
    }
  }

  const problema =
    aviso || detalle ? (
      <div className="mt-2">
        {aviso ? (
          <p role="status" className="text-xs text-estado-vencida">
            {aviso}
          </p>
        ) : null}
        {detalle ? (
          <p className="mt-1 select-all text-[11px] leading-snug text-zelanda-verde-700/70">
            {detalle}
          </p>
        ) : null}
      </div>
    ) : null;

  if (estado === 'cargando') {
    return <p className="text-sm text-zelanda-verde-700/70">Cargando...</p>;
  }

  if (estado === 'no-soporta') {
    return (
      <p className="text-sm text-zelanda-verde-700/70">
        Este navegador no soporta notificaciones push.
      </p>
    );
  }

  if (estado === 'denegado') {
    return (
      <p className="text-sm text-estado-vencida">
        Bloqueaste los avisos para esta app. Hay que volver a permitirlos desde el navegador: tocá
        el candado o los tres puntos junto a la dirección, entrá en Ajustes del sitio y poné
        Notificaciones en “Permitir”. Después volvé acá y activalos.
      </p>
    );
  }

  if (estado === 'activo') {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zelanda-verde-900">
            <Bell className="h-4 w-4 text-zelanda-verde-700" />
            Notificaciones activas en este dispositivo
          </div>
          <button
            type="button"
            onClick={desactivar}
            disabled={trabajando}
            className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm text-zelanda-verde-700 disabled:opacity-60"
          >
            {trabajando ? '...' : 'Desactivar'}
          </button>
        </div>
        {problema}
      </div>
    );
  }

  // 'inactivo' y 'sin-motor' comparten pantalla: en los dos casos lo que hace
  // falta es un botón para intentar, y en 'sin-motor' además el motivo de por
  // qué la consulta anterior no llegó a buen puerto.
  const faltaInstalar = esIPhone() && !estaInstalada();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zelanda-verde-700/70">
          <BellOff className="h-4 w-4" />
          Notificaciones desactivadas
        </div>
        {faltaInstalar ? null : (
          <button
            type="button"
            onClick={activar}
            disabled={trabajando}
            className="min-h-touch rounded-lg bg-zelanda-verde-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {trabajando
              ? '...'
              : faltaSegundoToque
              ? 'Terminar'
              : estado === 'sin-motor'
              ? 'Reintentar'
              : 'Activar'}
          </button>
        )}
      </div>
      {faltaSegundoToque ? (
        <p className="mt-2 text-xs text-zelanda-verde-700/80">
          Permiso concedido. Tocá una vez más para terminar de activarlos.
        </p>
      ) : null}
      {faltaInstalar ? (
        <p className="mt-2 text-xs text-zelanda-verde-700/80">
          En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio: tocá
          Compartir y luego “Agregar a inicio”. Después abrila desde el icono y activalos acá.
        </p>
      ) : null}
      {problema}
    </div>
  );
}
