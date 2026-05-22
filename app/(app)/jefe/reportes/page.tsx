import { TrendingUp, TrendingDown, Warehouse, ShoppingBag } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function PaginaReportes() {
  await requerirUsuario("JEFE");

  const [cosechasTotal, salidasTotal, stockRows] = await Promise.all([
    prisma.cosechas.aggregate({
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      _sum: { cantidad_kg: true },
    }),
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
  ]);

  const totalCosechaKg = Number(cosechasTotal._sum.peso_kg ?? 0);
  const nCosechas = cosechasTotal._count._all;
  const totalSalidasKg = Number(salidasTotal._sum.cantidad_kg ?? 0);
  const stockKg = Number(stockRows[0]?.stock_kg ?? 0);

  const fmtKg = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Reportes
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Reportes de la finca
        </h1>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Datos consolidados de todos los lotes y operaciones.
        </p>
      </header>

      {/* Sección 1: Resumen acumulado */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosecha total</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalCosechaKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <ShoppingBag className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosechas</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {nCosechas.toLocaleString("es-CO")}
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingDown className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Salidas totales</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalSalidasKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <Warehouse className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Stock actual</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(stockKg)} kg
          </p>
        </div>
      </section>
    </div>
  );
}
