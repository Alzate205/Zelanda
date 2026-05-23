import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioTarifa } from "./FormularioTarifa";

export const metadata = { title: "Nueva tarifa" };

export default async function PaginaNuevaTarifa() {
  await requerirUsuario("JEFE");

  const [tipos, lotes] = await Promise.all([
    prisma.tipos_tarea.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, area: true },
      orderBy: [{ area: "asc" }, { nombre: "asc" }],
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <FormularioTarifa
      tipos={tipos.map((t) => ({
        id: String(t.id),
        nombre: t.nombre,
        area: t.area,
      }))}
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
      }))}
    />
  );
}
