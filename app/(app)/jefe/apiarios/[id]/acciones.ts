"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoEdicionApiario = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarApiario(
  _prev: EstadoEdicionApiario,
  formData: FormData,
): Promise<EstadoEdicionApiario> {
  await requerirUsuario("JEFE");

  const apiarioId = parsearId(String(formData.get("apiario_id") ?? ""));
  if (!apiarioId) return { error: "ID de apiario inválido." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const totalColmenasRaw = String(formData.get("total_colmenas") ?? "").trim();
  const ubicacion_descripcion =
    String(formData.get("ubicacion_descripcion") ?? "").trim() || null;
  const activo = formData.get("activo") === "on";

  if (!nombre) return { error: "El nombre del apiario es obligatorio." };

  if (!/^\d+$/.test(totalColmenasRaw)) {
    return { error: "Total de colmenas debe ser un número entero mayor o igual a cero." };
  }
  const total_colmenas = parseInt(totalColmenasRaw, 10);
  if (total_colmenas < 0) {
    return { error: "Total de colmenas no puede ser negativo." };
  }

  try {
    await prisma.apiarios.update({
      where: { id: apiarioId },
      data: { nombre, total_colmenas, ubicacion_descripcion, activo },
    });
  } catch (e) {
    return { error: sanitizarError(e, "jefe/apiarios/actualizar") };
  }

  revalidatePath(`/jefe/apiarios/${apiarioId}`);
  revalidatePath("/jefe/lotes");
  redirect(`/jefe/apiarios/${apiarioId}`);
}
