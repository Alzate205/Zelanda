import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AvatarIniciales } from '@/components/shared/AvatarIniciales';
import { Badge, type EstadoBadge } from '@/components/ui/Badge';
import { Bar } from '@/components/ui/Bar';
import { Card } from '@/components/ui/Card';
import { formatearFechaCorta } from '@/lib/utils';
import { ETIQUETA_ESTADO_ASIGNACION } from '@/lib/constantes';
import { cancelarAsignacion, reabrirAsignacion } from '../acciones';
import { BotonSubmit } from './_botones';
import Image from 'next/image';
import { urlFotoFirmada } from '@/lib/supabase/storage';

export const metadata: Metadata = { title: 'Asignación' };

const ETIQUETA_ESTADO_APIARIO: Record<string, string> = {
  BIEN: 'Bien',
  CON_PROBLEMAS: 'Con problemas',
  CRITICO: 'Crítico',
};

function badgeEstado(estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA'): EstadoBadge {
  if (estado === 'COMPLETADA') return 'aldia';
  if (estado === 'CANCELADA') return 'vencida';
  if (estado === 'EN_CURSO') return 'proxima';
  return 'neutro';
}

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function formatearFechaHora(d: Date): string {
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    // Se renderiza en el servidor (UTC): sin la zona explícita la hora sale 5h adelantada.
    timeZone: 'America/Bogota',
  });
}

export default async function DetalleAsignacion({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('JEFE');
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      persona: { select: { nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
      registros_avance: {
        orderBy: { fecha_registro: 'desc' },
        include: { persona: { select: { nombre_completo: true } } },
      },
      // La miel vive en su propia tabla pero queda atada a la tarea: sin esto
      // el jefe no veía los kilos que sacó el trabajador.
      cosechas_miel: {
        orderBy: { fecha: 'desc' },
        include: { persona: { select: { nombre_completo: true } } },
      },
    },
  });

  if (!a) notFound();

  // Las fotos viven en almacenamiento privado: hay que firmar cada URL.
  const fotos = new Map<string, string>();
  for (const r of a.registros_avance) {
    if (!r.foto_path) continue;
    const url = await urlFotoFirmada(r.foto_path).catch(() => null);
    if (url) fotos.set(String(r.id), url);
  }

  let apiarioNombre: string | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true },
    });
    apiarioNombre = ap?.nombre ?? null;
  }

  const destino = a.lote_id
    ? { tipo: 'lote' as const, nombre: a.lotes!.nombre, total: a.lotes!.total_arboles }
    : { tipo: 'apiario' as const, nombre: apiarioNombre ?? '?', total: null };

  const abierta = a.estado === 'PENDIENTE' || a.estado === 'EN_CURSO';

  const pct = destino.total && destino.total > 0 ? a.arboles_completados / destino.total : 0;

  return (
    <div className="-mx-4 -mt-4 space-y-5">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-4 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <Link
            href="/jefe/asignaciones"
            aria-label="Volver"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              {destino.tipo === 'lote' ? 'Lote' : 'Apiario'} · {destino.nombre}
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[22px] font-medium leading-tight">
              {a.tipos_tarea.nombre}
            </h1>
          </div>
          <Badge estado={badgeEstado(a.estado)}>
            {ETIQUETA_ESTADO_ASIGNACION[a.estado] ?? a.estado}
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <AvatarIniciales
            id={String(a.persona_id)}
            nombre={a.persona.nombre_completo}
            tamano="sm"
          />
          <span className="text-[12.5px] text-zelanda-beige-100/85">
            {a.persona.nombre_completo}
          </span>
        </div>
      </div>

      <div className="space-y-5 px-4">
        <Card lift className="p-4">
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Información
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                Fecha inicio
              </dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {formatearFechaCorta(a.fecha_inicio)}
              </dd>
            </div>
            {a.fecha_completada ? (
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Completada
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  {formatearFechaCorta(a.fecha_completada)}
                </dd>
              </div>
            ) : null}
            {destino.total !== null ? (
              <div className="col-span-2">
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Progreso
                </dt>
                <dd className="mt-0.5 flex items-center justify-between text-zelanda-verde-900">
                  <span>
                    <strong className="font-serif">
                      {a.arboles_completados.toLocaleString('es-CO')}
                    </strong>{' '}
                    / {destino.total.toLocaleString('es-CO')} árboles
                  </span>
                  <span className="font-serif text-[15px]">{Math.round(pct * 100)}%</span>
                </dd>
                <Bar valor={pct} estado="aldia" className="mt-2" />
              </div>
            ) : null}
          </dl>
        </Card>

        <section>
          <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Historial de registros{' '}
            <span className="text-[11px] normal-case tracking-normal text-zelanda-verde-700/80">
              ({a.registros_avance.length})
            </span>
          </p>
          {a.registros_avance.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
              Sin registros aún.
            </p>
          ) : (
            <ul className="space-y-2">
              {a.registros_avance.map((r) => (
                <li
                  key={String(r.id)}
                  className="rounded-xl border border-zelanda-beige-200 bg-white px-3 py-2.5 shadow-suave"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="m-0 font-serif text-[14px] text-zelanda-verde-900">
                      {r.tipo_registro}
                      {r.tipo_registro === 'TRAMO'
                        ? ` · árboles ${r.arbol_desde}–${r.arbol_hasta}`
                        : ''}
                      {r.tipo_registro === 'SUELTOS' ? ` · ${r.cantidad_arboles} árboles` : ''}
                    </p>
                    <span className="whitespace-nowrap text-[11px] text-zelanda-verde-700">
                      {formatearFechaHora(r.fecha_registro)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    Por {r.persona.nombre_completo}
                  </p>
                  {r.tipo_registro === 'SUELTOS' && r.arboles_lista.length > 0 ? (
                    <p className="mt-1 text-[12.5px] text-zelanda-verde-800">
                      Árboles: {r.arboles_lista.join(', ')}
                    </p>
                  ) : null}
                  {r.estado_apiario ? (
                    <p className="mt-1 text-[12.5px] text-zelanda-verde-800">
                      Estado del apiario:{' '}
                      <strong>
                        {ETIQUETA_ESTADO_APIARIO[r.estado_apiario] ?? r.estado_apiario}
                      </strong>
                    </p>
                  ) : null}
                  {r.observaciones ? (
                    <p className="mt-1 text-[12.5px] text-zelanda-verde-800">{r.observaciones}</p>
                  ) : null}
                  {fotos.get(String(r.id)) ? (
                    <Image
                      src={fotos.get(String(r.id)) as string}
                      alt={`Foto del registro del ${formatearFechaHora(r.fecha_registro)}`}
                      width={800}
                      height={600}
                      className="mt-2 h-auto w-full rounded-lg object-cover"
                      unoptimized
                    />
                  ) : r.foto_path ? (
                    <p className="mt-1 text-[11.5px] text-zelanda-verde-700/70">
                      Hay una foto pero no se pudo cargar.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {a.cosechas_miel.length > 0 ? (
          <section>
            <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Miel cosechada{' '}
              <span className="text-[11px] normal-case tracking-normal text-zelanda-verde-700/80">
                (
                {a.cosechas_miel
                  .reduce((total, c) => total + Number(c.kg), 0)
                  .toLocaleString('es-CO', { maximumFractionDigits: 3 })}{' '}
                kg en total)
              </span>
            </p>
            <ul className="space-y-2">
              {a.cosechas_miel.map((c) => (
                <li
                  key={String(c.id)}
                  className="rounded-xl border border-zelanda-beige-200 bg-white px-3 py-2.5 shadow-suave"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                      {Number(c.kg).toLocaleString('es-CO', { maximumFractionDigits: 3 })} kg
                    </p>
                    <span className="whitespace-nowrap text-[11px] text-zelanda-verde-700">
                      {formatearFechaHora(c.fecha)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    Por {c.persona.nombre_completo}
                  </p>
                  {c.notas ? (
                    <p className="mt-1 text-[12.5px] text-zelanda-verde-800">{c.notas}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex gap-2 pb-2">
          {abierta ? (
            <>
              <Link
                href={`/jefe/asignaciones/${id}/editar`}
                className="flex min-h-touch items-center justify-center gap-1.5 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
              <form action={cancelarAsignacion} className="flex-1">
                <input type="hidden" name="asignacion_id" value={String(a.id)} />
                <BotonSubmit
                  texto="Cancelar"
                  textoPendiente="Cancelando…"
                  className="flex min-h-touch w-full items-center justify-center rounded-xl border border-[#e8b3ad] bg-[#f4dad7] px-4 font-semibold text-[#7b2a23] hover:bg-[#efc7c2] disabled:opacity-60"
                />
              </form>
            </>
          ) : a.estado === 'COMPLETADA' ? (
            <form action={reabrirAsignacion} className="flex-1">
              <input type="hidden" name="asignacion_id" value={String(a.id)} />
              <BotonSubmit
                texto="Reabrir"
                textoPendiente="Reabriendo…"
                className="flex min-h-touch w-full items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200 disabled:opacity-60"
              />
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
