import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioPago } from "./FormularioPago";

export const metadata = { title: "Nuevo pago" };

export default async function PaginaNuevoPago() {
  await requerirUsuario("JEFE");

  const personas = await prisma.personas.findMany({
    where: { deleted_at: null, activo: true },
    select: { id: true, nombre_completo: true },
    orderBy: { nombre_completo: "asc" },
  });

  return (
    <FormularioPago
      personas={personas.map((p) => ({
        id: String(p.id),
        nombre: p.nombre_completo,
      }))}
    />
  );
}
