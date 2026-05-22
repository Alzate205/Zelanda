import Link from "next/link";
import { AlertTriangle, PackageOpen, CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Bodega" };

export default async function PaginaInicioBodega() {
  const usuario = await requerirUsuario("BODEGA");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [abiertos, cerradosHoy, stockBajo, stockBajoTotal] = await Promise.all([
    prisma.despachos.count({ where: { estado: "ABIERTO" } }),
    prisma.despachos.count({
      where: { estado: "CERRADO", fecha_devolucion: { gte: inicioDia } },
    }),
    prisma.$queryRaw<
      { id: bigint; nombre: string; unidad: string; stock_disponible: string }[]
    >`
      SELECT id, nombre, unidad, stock_disponible::text
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
      ORDER BY nombre
      LIMIT 5
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
    `,
  ]);
  const totalStockBajo = Number(stockBajoTotal[0]?.total ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenido, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/bodega/despachos"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card transition hover:border-zelanda-verde-300"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <PackageOpen className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Despachos abiertos</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {abiertos}
          </p>
        </Link>

        <Link
          href="/bodega/inventario"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card transition hover:border-zelanda-verde-300"
        >
          <div className="flex items-center gap-2 text-estado-vencida">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Stock bajo</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {totalStockBajo}
          </p>
        </Link>

        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <CheckCircle2 className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Cerrados hoy</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {cerradosHoy}
          </p>
        </div>
      </div>

      {stockBajo.length > 0 && (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Insumos por debajo del mínimo
          </h2>
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {stockBajo.map((i) => (
              <li
                key={i.id.toString()}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-zelanda-verde-900">{i.nombre}</span>
                <span className="text-estado-vencida">
                  {i.stock_disponible} {i.unidad}
                </span>
              </li>
            ))}
          </ul>
          {totalStockBajo > stockBajo.length ? (
            <p className="mt-3 text-xs text-zelanda-verde-700/70">
              y {totalStockBajo - stockBajo.length} más — ver{" "}
              <Link href="/bodega/inventario" className="underline">
                inventario
              </Link>
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
