import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormAvance } from "./FormAvance";

export const metadata: Metadata = { title: "Registrar avance" };
export const dynamic = "force-dynamic";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export default async function PaginaAvance({
  params,
}: {
  params: Promise<{ asignacion_id: string }>;
}) {
  const usuario = await requerirUsuario();
  const { asignacion_id } = await params;
  const idBig = parsearId(asignacion_id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
    },
  });

  if (!a) notFound();
  if (usuario.persona_id === null || BigInt(usuario.persona_id) !== a.persona_id) notFound();
  if (a.estado !== "PENDIENTE" && a.estado !== "EN_CURSO") notFound();

  let apiarioNombre: string | null = null;
  let totalColmenas: number | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true, total_colmenas: true },
    });
    apiarioNombre = ap?.nombre ?? null;
    totalColmenas = ap?.total_colmenas ?? null;
  }

  return (
    <FormAvance
      asignacion={{
        id: String(a.id),
        tipoTarea: a.tipos_tarea.nombre,
        area: a.tipos_tarea.area,
        loteNombre: a.lotes?.nombre ?? null,
        totalArboles: a.lotes?.total_arboles ?? null,
        arbolesCompletados: a.arboles_completados,
        ultimoArbolTrabajado: a.ultimo_arbol_trabajado,
        apiarioNombre,
        totalColmenas,
      }}
    />
  );
}
