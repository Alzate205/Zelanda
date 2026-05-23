import { ArrowDownRight, ArrowUpRight, Warehouse } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KPI } from "@/components/ui/KPI";

export const metadata = { title: "Almacén" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

export default async function PaginaAlmacenJefe() {
  await requerirUsuario("JEFE");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [stockRows, cosechas, salidas, cosechasHoy, salidasHoy] =
    await Promise.all([
      prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
      prisma.cosechas.findMany({
        take: 30,
        orderBy: { fecha: "desc" },
        include: {
          persona: { select: { nombre_completo: true } },
          lotes: { select: { nombre: true } },
        },
      }),
      prisma.salidas_cosecha.findMany({
        take: 30,
        orderBy: { fecha: "desc" },
      }),
      prisma.cosechas.aggregate({
        where: { fecha: { gte: inicioDia } },
        _sum: { peso_kg: true },
        _count: { _all: true },
      }),
      prisma.salidas_cosecha.aggregate({
        where: { fecha: { gte: inicioDia } },
        _sum: { cantidad_kg: true },
        _count: { _all: true },
      }),
    ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  const ingresosHoyKg = Number(cosechasHoy._sum.peso_kg ?? 0);
  const salidasHoyKg = Number(salidasHoy._sum.cantidad_kg ?? 0);
  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Jefe · Almacén</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Almacén de cosecha
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Stock actual{" "}
          <strong className="text-zelanda-verde-900">
            {stock.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg
          </strong>
        </p>
      </header>

      <div className="rounded-2xl border border-zelanda-verde-200 bg-zelanda-verde-50 p-4 shadow-suave">
        <div className="flex items-center gap-2 text-zelanda-verde-700">
          <Warehouse className="h-4 w-4" />
          <span className="text-[10.5px] uppercase tracking-[0.14em]">
            Stock actual
          </span>
        </div>
        <p className="mt-1 font-serif text-[36px] leading-none text-zelanda-verde-900">
          {stock.toLocaleString("es-CO", { maximumFractionDigits: 0 })}{" "}
          <span className="text-base text-zelanda-verde-700">kg</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <KPI
          etiqueta="Ingresos hoy"
          valor={`${ingresosHoyKg.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg`}
          pie={`${cosechasHoy._count._all} ${cosechasHoy._count._all === 1 ? "cosecha" : "cosechas"}`}
        />
        <KPI
          etiqueta="Salidas hoy"
          valor={`${salidasHoyKg.toLocaleString("es-CO", { maximumFractionDigits: 0 })} kg`}
          pie={`${salidasHoy._count._all} ${salidasHoy._count._all === 1 ? "salida" : "salidas"}`}
          acento="ocre"
        />
      </div>

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Últimas cosechas{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({cosechas.length})
          </span>
        </h2>
        {cosechas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            Aún no hay cosechas registradas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {cosechas.map((c) => (
              <div
                key={c.id.toString()}
                className="flex items-center gap-3 rounded-xl border border-l-[3px] border-l-zelanda-verde-500 border-zelanda-beige-200 bg-white px-3 py-2.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-zelanda-verde-50 text-zelanda-verde-700">
                  <ArrowDownRight className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13.5px] text-zelanda-verde-900">
                    {c.lotes.nombre} · {c.persona.nombre_completo}
                  </p>
                  <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    {fmt(c.fecha)}
                  </p>
                </div>
                <span className="font-serif text-[18px] text-zelanda-verde-900">
                  +
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  <span className="text-[11px] text-zelanda-verde-700">kg</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
          Últimas salidas{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({salidas.length})
          </span>
        </h2>
        {salidas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {salidas.map((s) => (
              <div
                key={s.id.toString()}
                className="flex items-center gap-3 rounded-xl border border-l-[3px] border-l-zelanda-ocre-500 border-zelanda-beige-200 bg-white px-3 py-2.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-zelanda-ocre-50 text-zelanda-ocre-700">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${TONO_TIPO[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    {s.cliente_detalle ? (
                      <span className="truncate text-[13px] text-zelanda-verde-900">
                        {s.cliente_detalle}
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                    {fmt(s.fecha)}
                  </p>
                </div>
                <span className="font-serif text-[18px] text-zelanda-verde-900">
                  −
                  {Number(s.cantidad_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  <span className="text-[11px] text-zelanda-verde-700">kg</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
