'use client';

import Link from 'next/link';
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useColaPendientes } from '@/hooks/useColaPendientes';
import type { RolUsuario } from '@/types';

/**
 * Dónde revisa sus pendientes cada rol. El JEFE no aparece a propósito: no
 * registra nada por la cola offline, así que nunca tiene pendientes propios.
 */
const PATH_PENDIENTES_POR_ROL: Partial<Record<RolUsuario, string>> = {
  TRABAJADOR: '/trabajador/pendientes',
  BODEGA: '/bodega/pendientes',
  ALMACEN: '/almacen/pendientes',
};

export function BannerOffline({ rol }: { rol: RolUsuario }) {
  const online = useOnlineStatus();
  const { total, errores } = useColaPendientes();

  // La cola vive en el navegador, no en la cuenta. Si el jefe entra al celular
  // donde trabajó alguien más, le salía la alerta de sincronizar por registros
  // que no son suyos y que él no puede resolver.
  const destino = PATH_PENDIENTES_POR_ROL[rol];
  const pendientes = destino ? total : 0;
  const conError = destino ? errores : 0;

  if (online && pendientes === 0) return null;

  let tono = 'bg-zelanda-ocre-50 border-zelanda-ocre-300 text-zelanda-ocre-700';
  let Icono = CloudOff;
  let texto: string;

  if (!online && pendientes > 0) {
    texto = `${pendientes} pendiente${pendientes === 1 ? '' : 's'} · Sin señal`;
  } else if (!online) {
    texto = 'Sin señal';
  } else if (conError > 0) {
    tono = 'bg-estado-vencida/10 border-estado-vencida/40 text-estado-vencida';
    Icono = AlertTriangle;
    texto = `${conError} con error · revisar`;
  } else {
    tono = 'bg-zelanda-verde-50 border-zelanda-verde-300 text-zelanda-verde-800';
    Icono = RefreshCw;
    texto = `Sincronizando · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
  }

  const cuerpo = (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-suave ${tono}`}
    >
      <Icono className="h-3.5 w-3.5" />
      <span>{texto}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto flex max-w-screen-md justify-center px-4"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      {pendientes > 0 && destino ? (
        <Link href={destino} aria-label="Ver pendientes">
          {cuerpo}
        </Link>
      ) : (
        cuerpo
      )}
    </div>
  );
}
