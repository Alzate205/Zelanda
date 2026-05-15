import Link from "next/link";
import { Warehouse, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Almacén" };

export default async function PaginaInicioAlmacen() {
  const usuario = await requerirUsuario("ALMACEN");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [stockRows, cosechasHoy, salidasHoy] = await Promise.all([
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { cantidad_kg: true },
    }),
  ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenida, {usuario.nombre_completo.split(" ")[0]}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/almacen/cosecha"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingUp className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Cosechas hoy</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {cosechasHoy._count._all} ·{" "}
            {Number(cosechasHoy._sum.peso_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 2,
            })}{" "}
            kg
          </p>
        </Link>

        <Link
          href="/almacen/salidas"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingDown className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Salidas hoy</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {salidasHoy._count._all} ·{" "}
            {Number(salidasHoy._sum.cantidad_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 2,
            })}{" "}
            kg
          </p>
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Registrar cosecha
        </Link>
        <Link
          href="/almacen/salidas/nueva"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-2 text-sm text-zelanda-verde-700"
        >
          <Plus className="h-4 w-4" /> Registrar salida
        </Link>
      </div>
    </div>
  );
}
