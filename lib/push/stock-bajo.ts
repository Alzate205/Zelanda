import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarPushAUsuarios } from "./enviar";

export async function snapshotDisponiblesAntes(
  insumoIds: bigint[],
): Promise<Map<string, number>> {
  if (insumoIds.length === 0) return new Map();
  const filas = await prisma.$queryRaw<
    { id: bigint; stock_disponible: string }[]
  >`
    SELECT id, stock_disponible::text
    FROM v_insumos_stock
    WHERE id IN (${Prisma.join(insumoIds)})
  `;
  const m = new Map<string, number>();
  for (const f of filas) {
    m.set(f.id.toString(), Number(f.stock_disponible));
  }
  return m;
}

export async function notificarStockBajoSiCorresponde(
  insumoIds: bigint[],
  disponiblesAntes: Map<string, number>,
): Promise<void> {
  if (insumoIds.length === 0) return;
  const actuales = await prisma.$queryRaw<
    {
      id: bigint;
      nombre: string;
      unidad: string;
      stock_disponible: string;
      stock_minimo: string;
    }[]
  >`
    SELECT id, nombre, unidad, stock_disponible::text, stock_minimo::text
    FROM v_insumos_stock
    WHERE id IN (${Prisma.join(insumoIds)})
  `;
  const cruzados = actuales.filter((i) => {
    const antes = disponiblesAntes.get(i.id.toString()) ?? Number.MAX_VALUE;
    const ahora = Number(i.stock_disponible);
    const min = Number(i.stock_minimo);
    return antes > min && ahora <= min;
  });
  if (cruzados.length === 0) return;

  const bodegueros = await prisma.usuarios.findMany({
    where: { rol: "BODEGA", activo: true },
    select: { id: true },
  });
  if (bodegueros.length === 0) return;

  await enviarPushAUsuarios(
    bodegueros.map((b) => b.id),
    {
      titulo:
        cruzados.length === 1
          ? `Stock bajo: ${cruzados[0].nombre}`
          : `${cruzados.length} insumos bajo mínimo`,
      cuerpo: cruzados
        .map(
          (c) =>
            `${c.nombre} (${Number(c.stock_disponible).toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${c.unidad})`,
        )
        .join(" · "),
      url: "/bodega/inventario?cat=INSUMOS",
      tag: "stock-bajo",
    },
  );
}
