import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarLote } from "./FormularioEditarLote";
import { FormSiembra } from "./_form-siembra";

export const metadata: Metadata = { title: "Editar lote" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function formatearISO(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function PaginaEditarLote({
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
    select: {
      id: true,
      nombre: true,
      hectareas: true,
      fecha_siembra: true,
      total_arboles: true,
      notas: true,
      deleted_at: true,
    },
  });

  if (!lote || lote.deleted_at) notFound();

  return (
    <div className="space-y-6">
      <FormularioEditarLote
        lote={{
          id: String(lote.id),
          nombre: lote.nombre,
          hectareas: lote.hectareas !== null ? String(lote.hectareas) : null,
          fecha_siembra: formatearISO(lote.fecha_siembra),
          total_arboles: lote.total_arboles ?? 0,
          notas: lote.notas,
        }}
      />
      <FormSiembra
        loteId={String(lote.id)}
        fechaLote={formatearISO(lote.fecha_siembra)}
      />
    </div>
  );
}
