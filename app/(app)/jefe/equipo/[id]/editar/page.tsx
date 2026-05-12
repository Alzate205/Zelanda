import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarMiembro } from "./FormularioEditarMiembro";
import type { TipoVinculacion } from "@/types";

export const metadata: Metadata = { title: "Editar miembro" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarMiembro({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const persona = await prisma.personas.findUnique({
    where: { id: idBig },
    include: {
      vinculaciones: {
        where: { fecha_fin: null },
        take: 1,
        select: { tipo: true, rol_finca: true },
      },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const vincActiva = persona.vinculaciones[0]
    ? {
        tipo: persona.vinculaciones[0].tipo as TipoVinculacion,
        rol_finca: persona.vinculaciones[0].rol_finca,
      }
    : null;

  return (
    <FormularioEditarMiembro
      persona={{
        id: String(persona.id),
        nombre_completo: persona.nombre_completo,
        cedula: persona.cedula,
        telefono: persona.telefono,
        notas: persona.notas,
      }}
      vincActiva={vincActiva}
    />
  );
}
