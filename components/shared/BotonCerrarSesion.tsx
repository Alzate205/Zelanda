'use client';

import { LogOut } from 'lucide-react';
import { cerrarSesion } from '@/app/(auth)/login/acciones';
import { CLAVE_ROL } from './SesionLocal';

/**
 * Cierra sesión y, antes de irse, deja el celular limpio para el que siga.
 *
 * El service worker guarda HTML ya renderizado con el nombre y los datos de
 * quien lo pidió. Si eso se queda ahí, la próxima persona que abra la app sin
 * señal ve páginas de la sesión anterior. El rol guardado se borra por lo
 * mismo: sin él, el arranque offline no manda a la home de un rol que ya no
 * está adentro.
 *
 * Lo que NO se borra es el dueño de la cola (`zelanda_usuario_ultimo`): es lo
 * que impide que el próximo usuario suba, con sus cookies, los registros que
 * este dejó pendientes. Se sobrescribe solo cuando alguien más inicia sesión.
 */
export function BotonCerrarSesion() {
  const limpiar = () => {
    try {
      localStorage.removeItem(CLAVE_ROL);
    } catch {
      // Storage no disponible; seguimos con el cierre igual.
    }
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ tipo: 'cerrar-sesion' });
  };

  return (
    <form action={cerrarSesion} onSubmit={limpiar}>
      <button
        type="submit"
        aria-label="Cerrar sesión"
        className="flex min-h-touch min-w-touch items-center justify-center rounded-lg p-2 text-zelanda-beige-100 transition hover:bg-white/10"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </form>
  );
}
