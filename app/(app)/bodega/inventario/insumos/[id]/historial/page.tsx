import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioAjusteStock } from './_ajuste';

export const metadata = { title: 'Historial insumo' };

const ETIQUETA_TIPO: Record<string, string> = {
  INGRESO: 'Ingreso',
  RESERVA: 'Reservado',
  CONSUMO: 'Consumido',
  DEVOLUCION: 'Devuelto',
  AJUSTE: 'Ajuste',
};

const TONO_TIPO: Record<string, string> = {
  INGRESO: 'bg-zelanda-verde-700/10 text-zelanda-verde-800',
  RESERVA: 'bg-zelanda-ocre-700/10 text-zelanda-ocre-800',
  CONSUMO: 'bg-estado-vencida/10 text-estado-vencida',
  DEVOLUCION: 'bg-zelanda-verde-700/10 text-zelanda-verde-800',
  AJUSTE: 'bg-zelanda-beige-200 text-zelanda-verde-700',
};

export default async function PaginaHistorialInsumo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('BODEGA');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const insumo = await prisma.insumos.findUnique({
    where: { id: BigInt(id) },
  });
  if (!insumo) notFound();

  const movimientos = await prisma.movimientos_insumo.findMany({
    where: { insumo_id: BigInt(id) },
    orderBy: { fecha: 'desc' },
    take: 50,
    include: {
      usuarios: { select: { nombre_completo: true } },
      despacho_items: {
        select: {
          despacho_id: true,
          despachos: {
            select: { persona: { select: { nombre_completo: true } } },
          },
        },
      },
    },
  });

  const fmt = (d: Date) =>
    d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const disponible = Number(insumo.stock_actual) - Number(insumo.stock_reservado);

  return (
    <div className="space-y-6">
      <Link
        href="/bodega/inventario"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al inventario
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Insumo</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{insumo.nombre}</h1>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-zelanda-beige-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-zelanda-verde-700/70">Actual</p>
            <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
              {Number(insumo.stock_actual).toLocaleString('es-CO', {
                maximumFractionDigits: 3,
              })}{' '}
              {insumo.unidad}
            </p>
          </div>
          <div className="rounded-lg border border-zelanda-beige-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-zelanda-verde-700/70">
              Reservado
            </p>
            <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
              {Number(insumo.stock_reservado).toLocaleString('es-CO', {
                maximumFractionDigits: 3,
              })}
            </p>
          </div>
          <div className="rounded-lg border border-zelanda-beige-200 bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-zelanda-verde-700/70">
              Disponible
            </p>
            <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
              {disponible.toLocaleString('es-CO', {
                maximumFractionDigits: 3,
              })}
            </p>
          </div>
        </div>
      </header>

      {insumo.ingrediente_activo ||
      insumo.registro_ica ||
      insumo.periodo_carencia_dias != null ||
      insumo.periodo_reingreso_horas != null ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="font-serif text-lg text-zelanda-verde-900">Ficha técnica</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            {insumo.ingrediente_activo ? (
              <div className="flex justify-between gap-2">
                <dt className="text-zelanda-verde-700">Ingrediente activo</dt>
                <dd className="m-0 text-right text-zelanda-verde-900">
                  {insumo.ingrediente_activo}
                </dd>
              </div>
            ) : null}
            {insumo.registro_ica ? (
              <div className="flex justify-between gap-2">
                <dt className="text-zelanda-verde-700">Registro ICA</dt>
                <dd className="m-0 text-right text-zelanda-verde-900">{insumo.registro_ica}</dd>
              </div>
            ) : null}
            {insumo.periodo_carencia_dias != null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-zelanda-verde-700">Carencia</dt>
                <dd className="m-0 text-right text-zelanda-verde-900">
                  {insumo.periodo_carencia_dias} días sin cosechar
                </dd>
              </div>
            ) : null}
            {insumo.periodo_reingreso_horas != null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-zelanda-verde-700">Reingreso</dt>
                <dd className="m-0 text-right text-zelanda-verde-900">
                  {insumo.periodo_reingreso_horas} h sin entrar al lote
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-lg text-zelanda-verde-900">Ajustar stock</h2>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Sumá (positivo) o restá (negativo) cuando un insumo se rompe, se pierde, o el conteo
          físico no coincide.
        </p>
        <div className="mt-3">
          <FormularioAjusteStock insumoId={insumo.id.toString()} unidad={insumo.unidad} />
        </div>
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-lg text-zelanda-verde-900">Movimientos recientes</h2>
        {movimientos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">Aún no hay movimientos.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {movimientos.map((m) => {
              const cant = Number(m.cantidad);
              const positivo = cant > 0;
              return (
                <li key={m.id.toString()} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] ${TONO_TIPO[m.tipo] ?? ''}`}
                    >
                      {ETIQUETA_TIPO[m.tipo] ?? m.tipo}
                    </span>
                    <span
                      className={`font-serif text-base ${
                        positivo ? 'text-zelanda-verde-800' : 'text-estado-vencida'
                      }`}
                    >
                      {positivo ? '+' : ''}
                      {cant.toLocaleString('es-CO', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      {insumo.unidad}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zelanda-verde-700/70">
                    {fmt(m.fecha)}
                    {m.usuarios && ` · ${m.usuarios.nombre_completo}`}
                    {m.despacho_items?.despachos?.persona &&
                      ` · ${m.despacho_items.despachos.persona.nombre_completo}`}
                  </p>
                  {m.notas && (
                    <p className="mt-1 text-xs italic text-zelanda-verde-700">{m.notas}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
