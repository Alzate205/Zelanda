import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioCierreDespacho } from './_formulario';

export const metadata = { title: 'Despacho' };

function transcurrido(desde: Date): string {
  const ms = Date.now() - desde.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min - h * 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function PaginaDetalleDespacho({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('BODEGA');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const despacho = await prisma.despachos.findUnique({
    where: { id: BigInt(id) },
    include: {
      persona: { select: { nombre_completo: true } },
      asignacion: {
        select: {
          tipos_tarea: { select: { nombre: true } },
          lotes: { select: { id: true, nombre: true } },
          apiarios: { select: { nombre: true } },
        },
      },
      lotes: { select: { nombre: true } },
      despacho_items: {
        include: {
          herramientas: { select: { nombre: true } },
          insumos: { select: { nombre: true, unidad: true } },
        },
      },
    },
  });
  if (!despacho) notFound();

  const hayInsumos = despacho.despacho_items.some((it) => it.tipo_item === 'INSUMO');
  const lotes =
    despacho.estado === 'ABIERTO' && hayInsumos
      ? await prisma.lotes.findMany({
          where: { deleted_at: null },
          select: { id: true, nombre: true },
          orderBy: { nombre: 'asc' },
        })
      : [];

  // Solo preseleccionar el lote si sigue existiendo en el catálogo (no fue borrado lógicamente)
  const idPreseleccionado = despacho.asignacion?.lotes?.id?.toString() ?? null;
  const lotePreseleccionado =
    idPreseleccionado !== null && lotes.some((l) => l.id.toString() === idPreseleccionado)
      ? idPreseleccionado
      : null;

  const fmt = (d: Date) =>
    d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const tareaTxt = despacho.asignacion?.tipos_tarea?.nombre ?? null;
  const destinoTxt =
    despacho.asignacion?.lotes?.nombre ?? despacho.asignacion?.apiarios?.nombre ?? null;
  const subtitulo =
    tareaTxt && destinoTxt ? `${tareaTxt} · ${destinoTxt}` : tareaTxt ?? 'Sin asignación';

  return (
    <div className="-mx-4 -mt-4 space-y-5">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-4 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <Link
            href="/bodega/despachos"
            aria-label="Volver"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              {despacho.estado === 'ABIERTO' ? 'Cerrar despacho' : 'Despacho'} · #
              {despacho.id.toString()}
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[20px] font-medium leading-tight">
              {despacho.persona.nombre_completo} · {subtitulo}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="rounded-[10px] border border-zelanda-verde-200 bg-zelanda-verde-50 px-3 py-2 text-[12px] text-zelanda-verde-800">
          {despacho.estado === 'ABIERTO'
            ? `Abierto a las ${
                fmt(despacho.fecha).split(', ')[1] ?? fmt(despacho.fecha)
              } · hace ${transcurrido(despacho.fecha)}`
            : `Cerrado el ${despacho.fecha_devolucion ? fmt(despacho.fecha_devolucion) : '—'}`}
        </div>
      </div>

      {despacho.estado === 'CERRADO' ? (
        <section className="mx-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <ul className="divide-y divide-zelanda-beige-200">
            {despacho.despacho_items.map((it) => (
              <li key={it.id.toString()} className="py-2 text-sm">
                {it.tipo_item === 'HERRAMIENTA' ? (
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{it.herramientas?.nombre}</span>
                      <span>× {it.cantidad.toString()}</span>
                      <span>·</span>
                      {it.devuelto ? (
                        <span>devuelta</span>
                      ) : (
                        <span className="rounded bg-estado-vencida/10 px-1.5 py-0.5 text-xs font-medium text-estado-vencida">
                          no devuelta
                        </span>
                      )}
                    </p>
                    {it.condicion_devolucion ? (
                      <p className="mt-0.5 text-xs text-zelanda-ocre-700">
                        {it.condicion_devolucion}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p>
                    <span className="font-medium">{it.insumos?.nombre}</span> despachado{' '}
                    {it.cantidad.toString()} {it.insumos?.unidad}, consumido{' '}
                    {it.cantidad_consumida?.toString() ?? '—'}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {despacho.lotes ? (
            <p className="mt-2 border-t border-zelanda-beige-200 pt-2 text-xs text-zelanda-verde-700">
              Insumos aplicados en el lote{' '}
              <span className="font-medium">{despacho.lotes.nombre}</span>
            </p>
          ) : null}
        </section>
      ) : (
        <div className="px-4">
          <FormularioCierreDespacho
            despachoId={despacho.id.toString()}
            items={despacho.despacho_items.map((it) => ({
              id: it.id.toString(),
              tipo: it.tipo_item,
              nombre:
                it.tipo_item === 'HERRAMIENTA'
                  ? it.herramientas?.nombre ?? '?'
                  : it.insumos?.nombre ?? '?',
              unidad: it.insumos?.unidad ?? '',
              cantidad: it.cantidad.toString(),
            }))}
            lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))}
            lotePreseleccionado={lotePreseleccionado}
          />
        </div>
      )}
    </div>
  );
}
