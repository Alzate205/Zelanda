import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Hexagon } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { TarjetaApiario } from '@/components/jefe/TarjetaApiario';

export const metadata: Metadata = { title: 'Apiarios' };

/**
 * La lista de apiarios.
 *
 * Antes no existía: el atajo "Apiarios" del panel entraba directo a
 * `/jefe/apiarios/1`, así que el segundo apiario de la finca no se podía abrir
 * desde ningún lado.
 */
export default async function PaginaApiarios() {
  await requerirUsuario('JEFE');

  const apiarios = await prisma.apiarios.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, total_colmenas: true, ubicacion_descripcion: true },
    orderBy: { nombre: 'asc' },
  });

  const colmenas = apiarios.reduce((suma, a) => suma + a.total_colmenas, 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/jefe/lotes"
          className="inline-flex min-h-touch items-center gap-1 text-sm text-zelanda-verde-700"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Lotes y apiarios
        </Link>
        <Eyebrow>Apicultura</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Apiarios</h1>
        <p className="mt-0.5 text-sm text-zelanda-verde-700">
          {apiarios.length} apiario{apiarios.length === 1 ? '' : 's'} ·{' '}
          {colmenas.toLocaleString('es-CO')} colmena{colmenas === 1 ? '' : 's'}
        </p>
      </div>

      {apiarios.length === 0 ? (
        <div className="rounded-2xl border border-zelanda-beige-200 bg-white px-4 py-6 text-center shadow-suave">
          <Hexagon className="mx-auto h-6 w-6 text-zelanda-ocre-500" aria-hidden />
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Todavía no hay apiarios registrados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {apiarios.map((a) => (
            <TarjetaApiario
              key={String(a.id)}
              apiario={{
                id: String(a.id),
                nombre: a.nombre,
                total_colmenas: a.total_colmenas,
                ubicacion_descripcion: a.ubicacion_descripcion,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
