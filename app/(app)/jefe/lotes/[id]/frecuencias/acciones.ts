"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoFrecuencias = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function guardarFrecuencias(
  _prev: EstadoFrecuencias,
  formData: FormData,
): Promise<EstadoFrecuencias> {
  await requerirUsuario("JEFE");

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  if (!loteId) return { error: "ID de lote inválido." };

  const tipos = await prisma.tipos_tarea.findMany({
    where: { area: "CULTIVO", activo: true },
    select: { id: true, frecuencia_dias_default: true },
  });

  const operaciones: Prisma.PrismaPromise<unknown>[] = [];

  for (const t of tipos) {
    const raw = String(formData.get(`frec_${t.id}`) ?? "").trim();

    if (!raw) {
      operaciones.push(
        prisma.frecuencias_lote.deleteMany({
          where: { lote_id: loteId, tipo_tarea_id: t.id },
        }),
      );
      continue;
    }

    if (!/^\d+$/.test(raw)) {
      return { error: `Frecuencia inválida en uno de los campos.` };
    }
    const valor = parseInt(raw, 10);
    if (valor <= 0) {
      return { error: `La frecuencia debe ser mayor a cero.` };
    }

    if (valor === t.frecuencia_dias_default) {
      operaciones.push(
        prisma.frecuencias_lote.deleteMany({
          where: { lote_id: loteId, tipo_tarea_id: t.id },
        }),
      );
    } else {
      operaciones.push(
        prisma.frecuencias_lote.upsert({
          where: {
            lote_id_tipo_tarea_id: { lote_id: loteId, tipo_tarea_id: t.id },
          },
          update: { frecuencia_dias: valor },
          create: {
            lote_id: loteId,
            tipo_tarea_id: t.id,
            frecuencia_dias: valor,
          },
        }),
      );
    }
  }

  try {
    await prisma.$transaction(operaciones);
  } catch (e) {
    return { error: sanitizarError(e, "jefe/lotes/frecuencias/guardar") };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath(`/jefe/lotes/${loteId}/frecuencias`);
  redirect(`/jefe/lotes/${loteId}`);
}
