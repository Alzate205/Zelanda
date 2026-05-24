import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioAusencia } from "./FormularioAusencia";

export const metadata = { title: "Nueva ausencia" };

export default async function PaginaNuevaAusencia() {
  await requerirUsuario("JEFE");

  const personas = await prisma.personas.findMany({
    where: { deleted_at: null, activo: true },
    select: { id: true, nombre_completo: true },
    orderBy: { nombre_completo: "asc" },
  });

  return (
    <FormularioAusencia
      personas={personas.map((p) => ({
        id: String(p.id),
        nombre: p.nombre_completo,
      }))}
    />
  );
}
