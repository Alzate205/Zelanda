'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';

/**
 * El panel del jefe vive dentro del centro de control y su estado es local.
 * Para poder abrirlo desde el header —que es global— hay dos caminos: si ya
 * estamos en el mapa avisamos por evento, y si no, navegamos con `?panel=1`
 * para que el centro de control lo abra al montarse.
 */
export const EVENTO_ABRIR_PANEL = 'zelanda:abrir-panel-jefe';

export function BotonPanel() {
  const pathname = usePathname();
  const router = useRouter();

  function abrir() {
    if (pathname === '/jefe') {
      window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PANEL));
    } else {
      router.push('/jefe?panel=1');
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      aria-label="Abrir panel del jefe"
      className="flex min-h-touch min-w-touch items-center justify-center rounded-lg p-2 text-zelanda-beige-100 transition hover:bg-white/10"
    >
      <LayoutGrid className="h-5 w-5" />
    </button>
  );
}
