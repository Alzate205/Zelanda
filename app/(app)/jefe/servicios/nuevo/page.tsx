import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioServicio } from "./FormularioServicio";

export const metadata = { title: "Nuevo servicio" };

export default async function PaginaNuevoServicio() {
  await requerirUsuario("JEFE");

  const [personas, lotes] = await Promise.all([
    prisma.personas.findMany({
      where: { deleted_at: null, activo: true },
      select: { id: true, nombre_completo: true },
      orderBy: { nombre_completo: "asc" },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <FormularioServicio
      personas={personas.map((p) => ({
        id: String(p.id),
        nombre: p.nombre_completo,
      }))}
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
      }))}
    />
  );
}
