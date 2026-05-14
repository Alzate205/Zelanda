import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarApiario } from "./FormularioEditarApiario";

export const metadata: Metadata = { title: "Editar apiario" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarApiario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      total_colmenas: true,
      ubicacion_descripcion: true,
      activo: true,
    },
  });

  if (!apiario) notFound();

  return (
    <FormularioEditarApiario
      apiario={{
        id: String(apiario.id),
        nombre: apiario.nombre,
        total_colmenas: apiario.total_colmenas,
        ubicacion_descripcion: apiario.ubicacion_descripcion,
        activo: apiario.activo,
      }}
    />
  );
}
