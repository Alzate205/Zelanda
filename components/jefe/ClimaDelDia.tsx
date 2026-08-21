import { CloudRain, Sun, CloudSun } from 'lucide-react';
import type { DiaPronostico } from '@/lib/jefe/clima';

/**
 * El clima de un día, del tamaño de una etiqueta, para poder planificar la
 * semana sin cambiar de pantalla.
 *
 * El color va por si se puede trabajar, no por cuánta agua cae: un día de
 * 51 mm con la mañana seca es un día de trabajo, y pintarlo de rojo como si
 * fuera imposible haría que el jefe descarte una jornada que sí tiene.
 */

/** Las franjas en las que se trabaja: lo que pase de madrugada no cambia el plan. */
const FRANJAS_UTILES = ['mañana', 'tarde'] as const;

type Jornada = 'libre' | 'media' | 'perdida';

const ESTILO: Record<Jornada, string> = {
  libre: 'bg-zelanda-verde-600/15 text-zelanda-verde-800',
  media: 'bg-zelanda-ocre-500/25 text-zelanda-ocre-700',
  perdida: 'bg-estado-vencida/15 text-estado-vencida',
};

const ICONO = { libre: Sun, media: CloudSun, perdida: CloudRain };

function leerDia(dia: DiaPronostico): { jornada: Jornada; texto: string } {
  const utiles = dia.bloques.filter((b) =>
    (FRANJAS_UTILES as readonly string[]).includes(b.franja)
  );
  const mojadas = utiles.filter((b) => b.mojada);
  const mm = Math.round(dia.lluvia_mm);
  if (mojadas.length === 0) return { jornada: 'libre', texto: `Se puede trabajar · ${mm} mm` };
  if (mojadas.length >= utiles.length)
    return { jornada: 'perdida', texto: `Llueve todo el día · ${mm} mm` };
  const seca = mojadas[0].franja === 'mañana' ? 'tarde' : 'mañana';
  return { jornada: 'media', texto: `Solo por la ${seca} · ${mm} mm` };
}

export function ClimaDelDia({ dia }: { dia: DiaPronostico | undefined }) {
  if (!dia) return null;
  const { jornada, texto } = leerDia(dia);
  const Icono = ICONO[jornada];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
        ESTILO[jornada]
      } ${dia.confianza === 'baja' ? 'opacity-75' : ''}`}
      title={`${dia.resumen} · ${Math.round(dia.prob_lluvia)} % de probabilidad media${
        dia.confianza === 'baja' ? ' · a esta distancia el pronóstico es flojo' : ''
      }`}
    >
      <Icono className="h-3 w-3 shrink-0" aria-hidden />
      {texto}
    </span>
  );
}
