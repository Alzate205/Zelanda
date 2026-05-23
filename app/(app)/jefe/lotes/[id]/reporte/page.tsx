import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, FlaskConical, BarChart3 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reporte de lote" };

export default async function PaginaReporteLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const loteId = BigInt(id);

  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { id: true, nombre: true, total_arboles: true, hectareas: true },
  });
  if (!lote) notFound();

  const [totales, cosechasMes, ultimaCosecha, topRecolectores, consumoInsumos] =
    await Promise.all([
      prisma.cosechas.aggregate({
        where: { lote_id: loteId },
        _count: { _all: true },
        _sum: { peso_kg: true },
      }),
      prisma.$queryRaw<{ ym: string; total_kg: string; n_cosechas: number }[]>`
        SELECT
          TO_CHAR(fecha, 'YYYY-MM')          AS ym,
          SUM(peso_kg)::text                  AS total_kg,
          COUNT(*)::int                       AS n_cosechas
        FROM cosechas
        WHERE lote_id = ${loteId}
          AND fecha >= NOW() - INTERVAL '12 months'
        GROUP BY ym
        ORDER BY ym DESC
      `,
      prisma.cosechas.findFirst({
        where: { lote_id: loteId },
        orderBy: { fecha: "desc" },
        include: {
          persona: { select: { nombre_completo: true } },
        },
      }),
      prisma.$queryRaw<
        { persona_id: bigint; nombre_completo: string; total_kg: string }[]
      >`
        SELECT
          c.persona_id,
          p.nombre_completo,
          SUM(c.peso_kg)::text AS total_kg
        FROM cosechas c
        JOIN personas p ON p.id = c.persona_id
        WHERE c.lote_id = ${loteId}
        GROUP BY c.persona_id, p.nombre_completo
        ORDER BY SUM(c.peso_kg) DESC
        LIMIT 5
      `,
      prisma.$queryRaw<
        {
          insumo_id: bigint;
          nombre: string;
          unidad: string;
          total: string;
        }[]
      >`
        SELECT
          i.id                                AS insumo_id,
          i.nombre,
          i.unidad,
          SUM(di.cantidad_consumida)::text    AS total
        FROM despacho_items di
        JOIN despachos d ON d.id = di.despacho_id
        JOIN asignaciones a ON a.id = d.asignacion_id
        JOIN insumos i ON i.id = di.insumo_id
        WHERE a.lote_id = ${loteId}
          AND di.tipo_item = 'INSUMO'
          AND di.cantidad_consumida IS NOT NULL
          AND di.cantidad_consumida > 0
        GROUP BY i.id, i.nombre, i.unidad
        ORDER BY SUM(di.cantidad_consumida) DESC
      `,
    ]);

  const totalKg = Number(totales._sum.peso_kg ?? 0);
  const maxMes = cosechasMes.reduce(
    (m, r) => Math.max(m, Number(r.total_kg)),
    0,
  );

  const fmtFecha = (d: Date) =>
    d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const fmtMes = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-CO", {
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/jefe/lotes/${lote.id}`}
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al lote
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reporte · Lote
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          {lote.total_arboles} árboles
          {lote.hectareas ? ` · ${lote.hectareas} ha` : ""}
        </p>
      </header>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-center gap-2 text-zelanda-verde-700">
          <TrendingUp className="h-5 w-5" />
          <p className="text-xs uppercase tracking-wider">Cosecha acumulada</p>
        </div>
        <p className="mt-2 font-serif text-4xl text-zelanda-verde-900">
          {totalKg.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          {totales._count._all} cosecha{totales._count._all === 1 ? "" : "s"}{" "}
          registrada{totales._count._all === 1 ? "" : "s"}
        </p>
        {ultimaCosecha && (
          <p className="mt-3 text-sm text-zelanda-verde-900">
            Última:{" "}
            <span className="font-medium">
              {Number(ultimaCosecha.peso_kg).toLocaleString("es-CO", {
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </span>{" "}
            · {fmtFecha(ultimaCosecha.fecha)} ·{" "}
            {ultimaCosecha.persona.nombre_completo}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <BarChart3 className="h-5 w-5" /> Últimos 12 meses
        </h2>
        {cosechasMes.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin cosechas en los últimos 12 meses.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cosechasMes.map((r) => {
              const v = Number(r.total_kg);
              const pct = maxMes > 0 ? (v / maxMes) * 100 : 0;
              return (
                <li key={r.ym} className="text-sm">
                  <div className="flex items-center justify-between text-xs text-zelanda-verde-700/70">
                    <span>{fmtMes(r.ym)}</span>
                    <span>
                      {v.toLocaleString("es-CO", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      kg · {r.n_cosechas} cosecha{r.n_cosechas === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zelanda-beige-200">
                    <div
                      className="h-full rounded-full bg-zelanda-verde-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Recolectores principales
        </h2>
        {topRecolectores.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin datos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {topRecolectores.map((r) => (
              <li
                key={r.persona_id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <span className="truncate font-medium text-zelanda-verde-900">
                  {r.nombre_completo}
                </span>
                <span className="text-right font-serif text-zelanda-verde-900">
                  {Number(r.total_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <FlaskConical className="h-5 w-5" /> Insumos consumidos
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Solo cuenta los despachos asociados a una asignación de este lote.
        </p>
        {consumoInsumos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            No hay insumos consumidos en despachos ligados a este lote.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {consumoInsumos.map((c) => (
              <li
                key={c.insumo_id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <span className="truncate font-medium text-zelanda-verde-900">
                  {c.nombre}
                </span>
                <span className="text-right font-serif text-zelanda-verde-900">
                  {Number(c.total).toLocaleString("es-CO", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  {c.unidad}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
