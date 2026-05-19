import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GridInventario } from "./_grid";

export const metadata = { title: "Inventario" };

export default async function PaginaInventario() {
  await requerirUsuario("BODEGA");

  const [herramientas, prestadas, insumos] = await Promise.all([
    prisma.herramientas.findMany({ orderBy: { nombre: "asc" } }),
    prisma.despacho_items.groupBy({
      by: ["herramienta_id"],
      where: {
        tipo_item: "HERRAMIENTA",
        devuelto: false,
        herramienta_id: { not: null },
        despachos: { estado: "ABIERTO" },
      },
      _sum: { cantidad: true },
    }),
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        categoria: string;
        unidad: string;
        stock_actual: string;
        stock_reservado: string;
        stock_disponible: string;
        stock_minimo: string;
        por_debajo_minimo: boolean;
        activo: boolean;
      }[]
    >`
      SELECT
        id, nombre, categoria::text, unidad,
        stock_actual::text, stock_reservado::text,
        stock_disponible::text, stock_minimo::text,
        por_debajo_minimo, activo
      FROM v_insumos_stock
      ORDER BY nombre
    `,
  ]);

  const prestadasPorHerramienta = new Map<string, number>();
  for (const p of prestadas) {
    if (p.herramienta_id) {
      prestadasPorHerramienta.set(
        p.herramienta_id.toString(),
        Number(p._sum.cantidad ?? 0),
      );
    }
  }

  const items = [
    ...herramientas.map((h) => {
      const prest = prestadasPorHerramienta.get(h.id.toString()) ?? 0;
      const disponibles = h.total - prest;
      return {
        tipo: "HERRAMIENTA" as const,
        id: h.id.toString(),
        nombre: h.nombre,
        categoria: h.categoria as "CULTIVO" | "COSECHA" | "APICULTURA",
        activo: h.activo,
        total: h.total,
        prestadas: prest,
        disponibles,
      };
    }),
    ...insumos.map((i) => ({
      tipo: "INSUMO" as const,
      id: i.id.toString(),
      nombre: i.nombre,
      categoria: i.categoria as "CULTIVO" | "COSECHA" | "APICULTURA",
      activo: i.activo,
      unidad: i.unidad,
      stock_disponible: i.stock_disponible,
      stock_minimo: i.stock_minimo,
      por_debajo_minimo: i.por_debajo_minimo,
    })),
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Inventario
        </h1>
      </header>

      <GridInventario items={items} />
    </div>
  );
}
