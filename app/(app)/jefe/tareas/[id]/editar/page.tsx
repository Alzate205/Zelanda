import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarTipo } from "./FormularioEditarTipo";

export const metadata: Metadata = { title: "Editar tipo de tarea" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarTipo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      frecuencia_dias_default: true,
      area: true,
      color: true,
      icono: true,
    },
  });

  if (!tipo) notFound();

  return (
    <FormularioEditarTipo
      tipo={{
        id: String(tipo.id),
        nombre: tipo.nombre,
        descripcion: tipo.descripcion ?? "",
        frecuencia_dias_default: tipo.frecuencia_dias_default,
        area: tipo.area,
        color: tipo.color ?? "",
        icono: tipo.icono ?? "",
      }}
    />
  );
}
