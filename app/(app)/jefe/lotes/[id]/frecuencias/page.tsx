import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioFrecuencias } from "./FormularioFrecuencias";

export const metadata: Metadata = { title: "Frecuencias del lote" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaFrecuencias({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: idBig },
    select: { id: true, nombre: true, deleted_at: true },
  });

  if (!lote || lote.deleted_at) notFound();

  const tipos = await prisma.tipos_tarea.findMany({
    where: { area: "CULTIVO", activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      frecuencia_dias_default: true,
      frecuencias_lote: {
        where: { lote_id: idBig },
        select: { frecuencia_dias: true },
        take: 1,
      },
    },
  });

  return (
    <FormularioFrecuencias
      loteId={String(lote.id)}
      loteNombre={lote.nombre}
      tipos={tipos.map((t) => ({
        id: String(t.id),
        nombre: t.nombre,
        frecuencia_dias_default: t.frecuencia_dias_default,
        override: t.frecuencias_lote[0]?.frecuencia_dias ?? null,
      }))}
    />
  );
}
