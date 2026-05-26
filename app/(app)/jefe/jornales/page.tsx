import Link from 'next/link';
import { Plus, CalendarCheck, ChevronLeft, Pencil } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { borrarJornal } from './acciones';
import { mesBogota } from '@/lib/fecha';
import { ConfirmarBorrado } from '@/components/ui/ConfirmarBorrado';

export const metadata = { title: 'Jornales' };

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC', // jornales.fecha es DATE; UTC evita corrimiento al día anterior
});

function tituloFecha(d: Date): string {
  const texto = FORMATEADOR_FECHA.format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function claveFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  // Agrupar por fecha
  const grupos = new Map<string, typeof jornales>();
  for (const j of jornales) {
    const k = claveFecha(j.fecha);
    const arr = grupos.get(k) ?? [];
    arr.push(j);
    grupos.set(k, arr);
  }
  const ordenados = Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));

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

      {jornales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Sin jornales registrados
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Registrá cada día trabajado de un jornalero. La tarifa queda congelada al momento de
            registrar; si cambia después, los registros anteriores no se ven afectados.
          </p>
          <Link
            href="/jefe/jornales/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Registrar primer jornal
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {ordenados.map(([clave, lista]) => {
            const fecha = new Date(`${clave}T00:00:00`);
            const totalDia = lista.reduce((acc, j) => acc + Number(j.tarifa_aplicada), 0);
            return (
              <section key={clave}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-serif text-base text-zelanda-verde-900">
                    {tituloFecha(fecha)}
                  </h2>
                  <span className="text-[11.5px] text-zelanda-verde-700">
                    {lista.length} {lista.length === 1 ? 'persona' : 'personas'} ·{' '}
                    {fmtMonto(totalDia)}
                  </span>
                </div>
                <ul className="space-y-2">
                  {lista.map((j) => (
                    <li
                      key={String(j.id)}
                      className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                            {j.persona.nombre_completo}
                          </p>
                          <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                            {j.descripcion_actividad ?? 'Jornal del día'}
                            {j.lotes ? ` · Lote ${j.lotes.nombre}` : ''}
                          </p>
                        </div>
                        <span className="font-serif text-[18px] text-zelanda-verde-900">
                          {fmtMonto(Number(j.tarifa_aplicada))}
                        </span>
                      </div>
                      {j.notas ? (
                        <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">{j.notas}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Link
                          href={`/jefe/jornales/${j.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Link>
                        <ConfirmarBorrado
                          action={borrarJornal}
                          id={j.id}
                          mensaje={`¿Anular el jornal de ${j.persona.nombre_completo}? El registro quedará para trazabilidad.`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
