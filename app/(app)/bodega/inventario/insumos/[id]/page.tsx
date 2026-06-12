import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Detalle insumo' };

export default async function PaginaDetalleInsumo({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('BODEGA');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const insumo = await prisma.insumos.findUnique({
    where: { id: BigInt(id) },
  });
  if (!insumo) notFound();

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
          <h2 className="font-serif text-base text-zelanda-verde-900">Ficha técnica</h2>
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

      <div className="flex gap-3 text-sm">
        <Link
          href={`/bodega/inventario/insumos/${id}/editar`}
          className="rounded-xl border border-zelanda-beige-300 bg-white px-4 py-2 text-zelanda-verde-800 hover:bg-zelanda-beige-50"
        >
          Editar
        </Link>
        <Link
          href={`/bodega/inventario/insumos/${id}/historial`}
          className="rounded-xl border border-zelanda-beige-300 bg-white px-4 py-2 text-zelanda-verde-800 hover:bg-zelanda-beige-50"
        >
          Historial
        </Link>
        <Link
          href={`/bodega/inventario/insumos/${id}/ingresar`}
          className="rounded-xl bg-zelanda-verde-700 px-4 py-2 font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800"
        >
          Ingresar stock
        </Link>
      </div>
    </div>
  );
}
