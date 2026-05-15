import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioNovedad } from "./FormularioNovedad";

export const metadata: Metadata = { title: "Reportar novedad" };

export default async function PaginaNuevaNovedad() {
  await requerirUsuario();

  const lotes = await prisma.lotes.findMany({
    where: { deleted_at: null, total_arboles: { gt: 0 } },
    select: { id: true, nombre: true, total_arboles: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <FormularioNovedad
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        totalArboles: l.total_arboles,
      }))}
    />
  );
}
