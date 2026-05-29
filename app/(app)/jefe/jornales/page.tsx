import Link from 'next/link';
import { Plus, ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { mesBogota } from '@/lib/fecha';
import { ListaJornales } from './ListaJornales';

export const metadata = { title: 'Jornales' };

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

export default async function PaginaJornales() {
  await requerirUsuario('JEFE');

  const jornales = await prisma.jornales.findMany({
    where: { borrado_en: null },
    orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    include: {
      persona: { select: { nombre_completo: true } },
      lotes: { select: { nombre: true } },
    },
    take: 200,
  });

  // Totales del mes
  const { anio: anioHoy, mes: mesHoy } = mesBogota();
  const totalMes = jornales
    .filter((j) => j.fecha.getUTCFullYear() === anioHoy && j.fecha.getUTCMonth() === mesHoy)
    .reduce((acc, j) => acc + Number(j.tarifa_aplicada), 0);

  const jornalesMes = jornales.filter(
    (j) => j.fecha.getUTCFullYear() === anioHoy && j.fecha.getUTCMonth() === mesHoy
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
          <Eyebrow>Finanzas · Jornales</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Días trabajados</h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {jornalesMes} {jornalesMes === 1 ? 'jornal' : 'jornales'} este mes ·{' '}
            {fmtMonto(totalMes)}
          </p>
        </div>
        <Link
          href="/jefe/jornales/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <ListaJornales jornales={jornales} />
    </div>
  );
}
