import Link from 'next/link';
import { Plus, DollarSign, ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { cerrarTarifa, borrarTarifa } from './acciones';

export const metadata = { title: 'Tarifas de tarea' };

const ETIQUETA_ESQUEMA: Record<string, string> = {
  POR_JORNAL: 'Por jornal',
  POR_KG: 'Por kg',
  POR_ARBOL: 'Por árbol',
  POR_HECTAREA: 'Por ha',
  POR_HORA: 'Por hora',
  OTRO: 'Otro',
};

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export default async function PaginaTarifas() {
  await requerirUsuario('JEFE');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tarifas = await prisma.tarifas_tarea.findMany({
    orderBy: [{ vigente_hasta: { sort: 'asc', nulls: 'first' } }, { vigente_desde: 'desc' }],
    include: {
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true } },
    },
    take: 200,
  });

  const vigentes = tarifas.filter(
    (t) => (!t.vigente_hasta || t.vigente_hasta >= hoy) && t.vigente_desde <= hoy
  );
  const futuras = tarifas.filter((t) => t.vigente_desde > hoy);
  const cerradas = tarifas.filter((t) => t.vigente_hasta !== null && t.vigente_hasta < hoy);

  function fila(t: (typeof tarifas)[number], permitirCerrar: boolean) {
    const monto = Number(t.monto);
    const estado: 'aldia' | 'proxima' | 'neutro' =
      !t.vigente_hasta || t.vigente_hasta >= hoy
        ? t.vigente_desde > hoy
          ? 'proxima'
          : 'aldia'
        : 'neutro';
    return (
      <li
        key={String(t.id)}
        className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
              {t.tipos_tarea.nombre}
              {t.lotes ? (
                <span className="ml-1.5 text-[11.5px] font-normal text-zelanda-verde-700">
                  · Lote {t.lotes.nombre}
                </span>
              ) : null}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
              {ETIQUETA_ESQUEMA[t.esquema_pago]}
              {t.unidad ? ` · ${t.unidad}` : ''}
            </p>
          </div>
          <Badge estado={estado}>
            {estado === 'aldia' ? 'Vigente' : estado === 'proxima' ? 'A futuro' : 'Cerrada'}
          </Badge>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-serif text-[22px] text-zelanda-verde-900">{fmtMonto(monto)}</span>
          <span className="text-[11.5px] text-zelanda-verde-700">
            {fmtFecha(t.vigente_desde)}
            {t.vigente_hasta ? ` → ${fmtFecha(t.vigente_hasta)}` : ' → vigente'}
          </span>
        </div>

        {t.notas ? (
          <p className="m-0 mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
            {t.notas}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          {permitirCerrar ? (
            <form action={cerrarTarifa}>
              <input type="hidden" name="id" value={String(t.id)} />
              <button
                type="submit"
                className="rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-1.5 text-[12px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
              >
                Cerrar vigencia
              </button>
            </form>
          ) : null}
          <form action={borrarTarifa}>
            <input type="hidden" name="id" value={String(t.id)} />
            <button
              type="submit"
              className="rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-3 py-1.5 text-[12px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
            >
              Borrar
            </button>
          </form>
        </div>
      </li>
    );
  }

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
          <Eyebrow>Finanzas · Catálogo</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Tarifas por tarea</h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {vigentes.length} vigentes · {futuras.length} a futuro · {cerradas.length} cerradas
          </p>
        </div>
        <Link
          href="/jefe/tarifas/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      {vigentes.length === 0 && futuras.length === 0 && cerradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <DollarSign className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Sin tarifas configuradas
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Las tarifas son la base para calcular pagos por jornal, por kg cosechado, por árbol,
            etc. Crea la primera.
          </p>
          <Link
            href="/jefe/tarifas/nueva"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Crear primera tarifa
          </Link>
        </div>
      ) : (
        <>
          {vigentes.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Vigentes{' '}
                <span className="text-sm font-normal text-zelanda-verde-700">
                  ({vigentes.length})
                </span>
              </h2>
              <ul className="space-y-2">{vigentes.map((t) => fila(t, true))}</ul>
            </section>
          ) : null}
          {futuras.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                A futuro{' '}
                <span className="text-sm font-normal text-zelanda-verde-700">
                  ({futuras.length})
                </span>
              </h2>
              <ul className="space-y-2">{futuras.map((t) => fila(t, true))}</ul>
            </section>
          ) : null}
          {cerradas.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Cerradas{' '}
                <span className="text-sm font-normal text-zelanda-verde-700">
                  ({cerradas.length})
                </span>
              </h2>
              <ul className="space-y-2">{cerradas.map((t) => fila(t, false))}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
