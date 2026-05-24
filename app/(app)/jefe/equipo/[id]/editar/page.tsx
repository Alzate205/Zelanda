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
        select: {
          tipo: true,
          rol_finca: true,
          salario_base: true,
          periodo_pago: true,
          tarifa_jornal: true,
          esquema_pago_destajo: true,
        },
      },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const v = persona.vinculaciones[0];
  const vincActiva = v
    ? {
        tipo: v.tipo as TipoVinculacion,
        rol_finca: v.rol_finca,
        salario_base: v.salario_base ? Number(v.salario_base) : null,
        periodo_pago: v.periodo_pago,
        tarifa_jornal: v.tarifa_jornal ? Number(v.tarifa_jornal) : null,
        esquema_pago_destajo: v.esquema_pago_destajo,
      }
    : null;

  return (
    <FormularioEditarMiembro
      persona={{
        id: String(persona.id),
        nombre_completo: persona.nombre_completo,
        cedula: persona.cedula,
        telefono: persona.telefono,
        fecha_nacimiento: persona.fecha_nacimiento
          ? persona.fecha_nacimiento.toISOString().slice(0, 10)
          : null,
        notas: persona.notas,
      }}
      vincActiva={vincActiva}
    />
  );
}
