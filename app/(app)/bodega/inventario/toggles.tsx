'use client';

import { useActionState } from 'react';
import { cambiarEstadoHerramienta, cambiarEstadoInsumo } from './acciones';

const ESTADO_INICIAL = { error: null as string | null };

const boton = 'min-h-touch rounded-lg px-3 text-sm font-semibold disabled:opacity-60';
const bajaClase = `${boton} border border-[#e8b3ad] bg-[#f4dad7] text-[#7b2a23] hover:bg-[#efc7c2]`;
const altaClase = `${boton} bg-zelanda-verde-700 text-white hover:bg-zelanda-verde-800`;

/**
 * Dar de baja no borra: los despachos ya hechos referencian la herramienta y
 * borrarla dejaría huecos en el historial. Dada de baja desaparece de las
 * listas donde se elige qué despachar, que es lo que se busca al querer
 * "eliminarla".
 */
function Baja({
  accion,
  id,
  activo,
  que,
}: {
  accion: (prev: { error: string | null }, fd: FormData) => Promise<{ error: string | null }>;
  id: string;
  activo: boolean;
  que: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={String(!activo)} />
      <button type="submit" disabled={pendiente} className={activo ? bajaClase : altaClase}>
        {pendiente ? 'Guardando…' : activo ? `Dar de baja ${que}` : `Reactivar ${que}`}
      </button>
      <p className="m-0 text-[11.5px] text-zelanda-verde-700/70">
        {activo
          ? 'Deja de aparecer para despachar. El historial se conserva.'
          : `Est${que === 'la herramienta' ? 'á' : 'á'} dada de baja: no aparece para despachar.`}
      </p>
      {estado.error ? (
        <p role="alert" className="m-0 text-[12px] text-estado-vencida">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}

export function ToggleActivoHerramienta({ id, activo }: { id: string; activo: boolean }) {
  return <Baja accion={cambiarEstadoHerramienta} id={id} activo={activo} que="la herramienta" />;
}

export function ToggleActivoInsumo({ id, activo }: { id: string; activo: boolean }) {
  return <Baja accion={cambiarEstadoInsumo} id={id} activo={activo} que="el insumo" />;
}
