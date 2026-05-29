import Link from 'next/link';
import { Plus, UserMinus, ChevronLeft, Pencil } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { borrarAusencia } from './acciones';
import { mesBogota } from '@/lib/fecha';
import { ConfirmarBorrado } from '@/components/ui/ConfirmarBorrado';

export const metadata = { title: 'Ausencias' };

const ETIQUETA_TIPO: Record<string, string> = {
  FALTA_INJUSTIFICADA: 'Falta injustificada',
  INCAPACIDAD: 'Incapacidad',
  VACACIONES: 'Vacaciones',
  LICENCIA: 'Licencia',
  PERMISO: 'Permiso',
};

const ESTADO_BADGE: Record<string, 'aldia' | 'proxima' | 'vencida' | 'neutro'> = {
  FALTA_INJUSTIFICADA: 'vencida',
  INCAPACIDAD: 'neutro',
  VACACIONES: 'aldia',
  LICENCIA: 'proxima',
  PERMISO: 'proxima',
};

function fmtFecha(d: Date): string {
  // ausencias.fecha es DATE; timeZone 'UTC' evita corrimiento al día anterior.
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

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
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {ausencias.length} registradas · {totalMes} este mes
          </p>
        </div>
        <Link
          href="/jefe/ausencias/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      {ausencias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <UserMinus className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Sin ausencias registradas
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Registrá días no trabajados para que el cálculo de saldos de los fijos descuente los
            días que correspondan.
          </p>
          <Link
            href="/jefe/ausencias/nueva"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Registrar primera
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {ausencias.map((a) => {
            const estado = ESTADO_BADGE[a.tipo] ?? 'neutro';
            return (
              <li
                key={String(a.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                      {a.persona.nombre_completo}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                      {fmtFecha(a.fecha)}
                      {a.descontable ? ' · Descuenta' : ' · No descuenta'}
                    </p>
                  </div>
                  <Badge estado={estado}>{ETIQUETA_TIPO[a.tipo] ?? a.tipo}</Badge>
                </div>
                {a.observaciones ? (
                  <p className="m-0 mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
                    {a.observaciones}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Link
                    href={`/jefe/ausencias/${a.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <ConfirmarBorrado
                    action={borrarAusencia}
                    id={a.id}
                    mensaje={`¿Anular la ausencia de ${a.persona.nombre_completo}? El registro quedará para trazabilidad.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
