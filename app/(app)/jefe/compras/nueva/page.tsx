import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCompra } from "./FormularioCompra";

export const metadata = { title: "Nueva compra" };

export default async function PaginaNuevaCompra() {
  await requerirUsuario("JEFE");

  const [proveedores, insumos] = await Promise.all([
    prisma.proveedores.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.insumos.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, unidad: true, costo_unitario: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <FormularioCompra
      proveedores={proveedores.map((p) => ({
        id: String(p.id),
        nombre: p.nombre,
      }))}
      insumos={insumos.map((i) => ({
        id: String(i.id),
        nombre: i.nombre,
        unidad: i.unidad,
        costo_unitario: i.costo_unitario ? Number(i.costo_unitario) : null,
      }))}
    />
  );
}
