import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WizardNuevoDespacho } from "./WizardNuevoDespacho";

export const metadata = { title: "Nuevo despacho" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoDespacho() {
  await requerirUsuario("BODEGA");

  const [personas, herramientas, insumos, asignaciones] = await Promise.all([
    prisma.personas.findMany({
      where: { activo: true, deleted_at: null },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.herramientas.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, categoria: true, total: true },
    }),
    prisma.insumos.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        categoria: true,
        unidad: true,
        stock_actual: true,
        stock_reservado: true,
      },
    }),
    prisma.asignaciones.findMany({
      where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } },
      select: {
        id: true,
        persona_id: true,
        tipos_tarea: { select: { nombre: true } },
        lotes: { select: { nombre: true } },
        apiarios: { select: { nombre: true } },
      },
    }),
  ]);

  return (
    <WizardNuevoDespacho
      personas={personas.map((p) => ({
        id: p.id.toString(),
        nombre: p.nombre_completo,
      }))}
      herramientas={herramientas.map((h) => ({
        id: h.id.toString(),
        nombre: h.nombre,
        categoria: h.categoria as "CULTIVO" | "COSECHA" | "APICULTURA",
        disponible: h.total,
      }))}
      insumos={insumos.map((i) => ({
        id: i.id.toString(),
        nombre: i.nombre,
        categoria: i.categoria as "CULTIVO" | "COSECHA" | "APICULTURA",
        unidad: i.unidad,
        disponible: Number(i.stock_actual) - Number(i.stock_reservado),
      }))}
      asignaciones={asignaciones.map((a) => ({
        id: a.id.toString(),
        persona_id: a.persona_id.toString(),
        etiqueta: `${a.tipos_tarea.nombre} · ${
          a.lotes?.nombre ?? a.apiarios?.nombre ?? "—"
        }`,
      }))}
    />
  );
}
