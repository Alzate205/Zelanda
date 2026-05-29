import Link from 'next/link';
import { Plus, ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { mesBogota } from '@/lib/fecha';
import { ListaAusencias } from './ListaAusencias';

export const metadata = { title: 'Ausencias' };

export default async function PaginaAusencias() {
  await requerirUsuario('JEFE');

  const ausencias = await prisma.ausencias.findMany({
    where: { borrado_en: null },
    orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    include: {
      persona: { select: { nombre_completo: true } },
    },
    take: 200,
  });

  const { anio: anioHoy, mes: mesHoy } = mesBogota();
  const totalMes = ausencias.filter(
    (a) => a.fecha.getUTCFullYear() === anioHoy && a.fecha.getUTCMonth() === mesHoy
  ).length;

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Finanzas · Ausencias</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Días no trabajados</h1>
        </div>
        <Link
          href="/jefe/ausencias/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <ListaAusencias ausencias={ausencias} totalMes={totalMes} />
    </div>
  );
}
