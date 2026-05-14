"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicionLote = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarLote(
  _prev: EstadoEdicionLote,
  formData: FormData,
): Promise<EstadoEdicionLote> {
  await requerirUsuario("JEFE");

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  if (!loteId) return { error: "ID de lote inválido." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const hectareasRaw = String(formData.get("hectareas") ?? "").trim();
  const fechaSiembraRaw = String(formData.get("fecha_siembra") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre) return { error: "El nombre del lote es obligatorio." };

  let hectareas: number | null = null;
  if (hectareasRaw) {
    const h = Number(hectareasRaw);
    if (!Number.isFinite(h) || h < 0) {
      return { error: "Hectáreas debe ser un número mayor o igual a cero." };
    }
    hectareas = h;
  }

  let fecha_siembra: Date | null = null;
  if (fechaSiembraRaw) {
    const f = new Date(fechaSiembraRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de siembra inválida." };
    }
    fecha_siembra = f;
  }

  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null, NOT: { id: loteId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya hay otro lote con ese nombre." };
  }

  try {
    await prisma.lotes.update({
      where: { id: loteId },
      data: { nombre, hectareas, fecha_siembra, notas },
    });
  } catch (e) {
    return { error: `No se pudo actualizar el lote: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath("/jefe/lotes");
  redirect(`/jefe/lotes/${loteId}`);
}
