import Link from 'next/link';
import { Hexagon } from 'lucide-react';

/**
 * La tarjeta de un apiario en una lista.
 *
 * Vive aparte porque la muestran dos pantallas —la de lotes y la de apiarios—
 * y ya pasó varias veces en este proyecto que dos copias del mismo pedazo se
 * separen sin que nadie lo note.
 */
export type ApiarioDeLista = {
  id: string;
  nombre: string;
  total_colmenas: number;
  ubicacion_descripcion: string | null;
};

export function TarjetaApiario({ apiario }: { apiario: ApiarioDeLista }) {
  return (
    <Link
      href={`/jefe/apiarios/${apiario.id}`}
      className="block rounded-2xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
    >
      <div className="flex items-center gap-2">
        <Hexagon className="h-4 w-4 shrink-0 text-zelanda-ocre-500" />
        <h3 className="font-serif text-lg text-zelanda-verde-900">{apiario.nombre}</h3>
      </div>
      <div className="mt-1 text-xs text-zelanda-verde-700">
        {apiario.total_colmenas} colmenas
        {apiario.ubicacion_descripcion ? ` · ${apiario.ubicacion_descripcion}` : ''}
      </div>
    </Link>
  );
}
