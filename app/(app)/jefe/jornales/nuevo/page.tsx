import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioJornal } from "./FormularioJornal";

export const metadata = { title: "Nuevo jornal" };

export default async function PaginaNuevoJornal() {
  await requerirUsuario("JEFE");

  const [personas, lotes] = await Promise.all([
    prisma.personas.findMany({
      where: { deleted_at: null, activo: true },
      select: {
        id: true,
        nombre_completo: true,
        vinculaciones: {
          where: { fecha_fin: null },
          select: { tipo: true, tarifa_jornal: true },
          orderBy: { fecha_inicio: "desc" },
          take: 1,
        },
      },
      orderBy: { nombre_completo: "asc" },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <FormularioJornal
      personas={personas.map((p) => {
        const vinc = p.vinculaciones[0] ?? null;
        return {
          id: String(p.id),
          nombre: p.nombre_completo,
          tipo: vinc?.tipo ?? null,
          tarifa_jornal: vinc?.tarifa_jornal ? Number(vinc.tarifa_jornal) : null,
        };
      })}
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
      }))}
    />
  );
}
