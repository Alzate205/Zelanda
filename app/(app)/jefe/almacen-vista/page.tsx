import { Warehouse, TrendingUp, TrendingDown } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Almacén" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

export default async function PaginaAlmacenJefe() {
  await requerirUsuario("JEFE");

  const [stockRows, cosechas, salidas] = await Promise.all([
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
  ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Almacén de cosecha
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-zelanda-verde-700">
          <Warehouse className="h-5 w-5" />
          <p className="text-xs uppercase tracking-wider">Stock actual</p>
        </div>
        <p className="mt-2 font-serif text-4xl text-zelanda-verde-900">
          {stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <TrendingUp className="h-5 w-5" /> Últimas cosechas
        </h2>
        {cosechas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay cosechas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cosechas.map((c) => (
              <li
                key={c.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {c.persona.nombre_completo} · {c.lotes.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(c.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif">
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <TrendingDown className="h-5 w-5" /> Últimas salidas
        </h2>
        {salidas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {salidas.map((s) => (
              <li
                key={s.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    {s.cliente_detalle && (
                      <span className="truncate text-zelanda-verde-900">
                        {s.cliente_detalle}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(s.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif">
                  {Number(s.cantidad_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
