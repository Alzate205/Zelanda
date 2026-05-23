import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { KPI } from "@/components/ui/KPI";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata = { title: "Reporte de lote" };
export const dynamic = "force-dynamic";

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
        ORDER BY ym ASC
      `,
      prisma.cosechas.findFirst({
        where: { lote_id: loteId },
        orderBy: { fecha: "desc" },
        include: {
          persona: { select: { nombre_completo: true } },
        },
      }),
      prisma.$queryRaw<
        {
          persona_id: bigint;
          nombre_completo: string;
          total_kg: string;
          n_cosechas: number;
        }[]
      >`
        SELECT
          c.persona_id,
          p.nombre_completo,
          SUM(c.peso_kg)::text AS total_kg,
          COUNT(c.id)::int     AS n_cosechas
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
  const promedioKgArbol =
    lote.total_arboles > 0 ? totalKg / lote.total_arboles : 0;
  const maxMes = cosechasMes.reduce(
    (m, r) => Math.max(m, Number(r.total_kg)),
    0,
  );
  const maxRecolector = topRecolectores.reduce(
    (m, r) => Math.max(m, Number(r.total_kg)),
    0,
  );

  const fmtKg = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

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
    <div className="-mx-4 -mt-4 space-y-5">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-4 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <Link
            href={`/jefe/lotes/${lote.id}`}
            aria-label="Volver al lote"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Reporte · Lote
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[22px] font-medium leading-tight">
              {lote.nombre}
            </h1>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-zelanda-beige-100/85">
          <span>
            <strong className="font-serif text-sm text-white">
              {lote.total_arboles.toLocaleString("es-CO")}
            </strong>{" "}
            árboles
          </span>
          {lote.hectareas ? (
            <span>
              <strong className="font-serif text-sm text-white">
                {Number(lote.hectareas).toFixed(1)}
              </strong>{" "}
              ha
            </span>
          ) : null}
          <span>
            <strong className="font-serif text-sm text-white">
              {totales._count._all}
            </strong>{" "}
            cosechas
          </span>
        </div>
      </div>

      <div className="space-y-5 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          <KPI
            etiqueta="Total cosechado"
            valor={`${fmtKg(totalKg)} kg`}
            pie={`${totales._count._all} cosechas`}
          />
          <KPI
            etiqueta="Promedio"
            valor={`${promedioKgArbol.toFixed(1)} kg`}
            pie="por árbol"
            acento="ocre"
          />
        </div>

        {ultimaCosecha ? (
          <section className="rounded-2xl border border-zelanda-verde-200 bg-zelanda-verde-50 p-4">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
              Última cosecha
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="font-serif text-[24px] text-zelanda-verde-900">
                {fmtKg(Number(ultimaCosecha.peso_kg))}{" "}
                <span className="text-[14px] text-zelanda-verde-700">kg</span>
              </span>
              <span className="text-[12px] text-zelanda-verde-700">
                {fmtFecha(ultimaCosecha.fecha)}
              </span>
            </div>
            <p className="m-0 mt-1 text-[12px] text-zelanda-verde-700">
              Por {ultimaCosecha.persona.nombre_completo}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Cosecha últimos 12 meses
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              {(totalKg / 1000).toFixed(1)} t totales
            </p>
          </div>
          {cosechasMes.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-6 text-center text-sm text-zelanda-verde-700">
              Sin cosechas en los últimos 12 meses.
            </p>
          ) : (
            <>
              <div
                className="mt-4 grid items-end gap-1"
                style={{
                  gridTemplateColumns: `repeat(${cosechasMes.length}, 1fr)`,
                  height: "100px",
                }}
              >
                {cosechasMes.map((m, i) => {
                  const v = Number(m.total_kg);
                  const altura =
                    maxMes > 0 ? Math.max(4, Math.round((v / maxMes) * 80)) : 4;
                  const esUltimo = i === cosechasMes.length - 1;
                  return (
                    <div
                      key={m.ym}
                      className="flex flex-col items-center justify-end gap-0.5"
                      title={`${fmtMes(m.ym)}: ${fmtKg(v)} kg`}
                    >
                      <span className="text-[9px] font-semibold text-zelanda-verde-900">
                        {fmtKg(v)}
                      </span>
                      <div
                        className={`w-full rounded-t-[3px] ${esUltimo ? "bg-zelanda-ocre-500" : "bg-zelanda-verde-600"}`}
                        style={{ height: `${altura}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div
                className="mt-1.5 grid gap-1 text-center text-[8.5px] text-zelanda-verde-700"
                style={{
                  gridTemplateColumns: `repeat(${cosechasMes.length}, 1fr)`,
                }}
              >
                {cosechasMes.map((m) => (
                  <span key={m.ym}>{fmtMes(m.ym).split(" ")[0]}</span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Top recolectores del lote
          </h2>
          {topRecolectores.length === 0 ? (
            <p className="mt-3 text-sm text-zelanda-verde-700">
              Sin datos todavía.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {topRecolectores.map((r, i) => {
                const kg = Number(r.total_kg);
                const pct = maxRecolector > 0 ? (kg / maxRecolector) * 100 : 0;
                return (
                  <li key={r.persona_id.toString()}>
                    <div className="mb-1 flex items-center gap-2.5">
                      <span className="w-5 text-center font-serif text-[13px] text-zelanda-verde-700">
                        {i + 1}
                      </span>
                      <AvatarIniciales
                        id={String(r.persona_id)}
                        nombre={r.nombre_completo}
                        tamano="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-zelanda-verde-900">
                        {r.nombre_completo}
                      </span>
                      <span className="text-[11.5px] text-zelanda-verde-700">
                        {r.n_cosechas} cos.
                      </span>
                      <span className="font-serif text-[14px] text-zelanda-verde-900">
                        {fmtKg(kg)}{" "}
                        <span className="text-[10px] text-zelanda-verde-700">
                          kg
                        </span>
                      </span>
                    </div>
                    <div className="ml-[34px] h-1.5 overflow-hidden rounded-full bg-zelanda-beige-200">
                      <div
                        className="h-full rounded-full bg-zelanda-verde-600"
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
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Insumos consumidos
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Sumatoria de despachos asociados a asignaciones de este lote
            </p>
          </div>
          {consumoInsumos.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-6 text-center text-sm text-zelanda-verde-700">
              No hay insumos consumidos en despachos ligados a este lote.
            </p>
          ) : (
            <ul className="mt-3">
              {consumoInsumos.map((c, i) => (
                <li
                  key={c.insumo_id.toString()}
                  className={`flex items-center justify-between py-2 text-[13px] ${i > 0 ? "border-t border-zelanda-beige-200" : ""}`}
                >
                  <span className="truncate text-zelanda-verde-900">
                    {c.nombre}
                  </span>
                  <span className="font-serif text-zelanda-verde-900">
                    {Number(c.total).toLocaleString("es-CO", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    <span className="text-[10px] text-zelanda-verde-700">
                      {c.unidad}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Eyebrow className="pt-2 text-center">
          Reporte generado{" "}
          {new Date().toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </Eyebrow>
      </div>
    </div>
  );
}
