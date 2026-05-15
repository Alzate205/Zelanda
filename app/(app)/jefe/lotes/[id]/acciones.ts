"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicionLote = { error: string | null; aviso: string | null };

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
  if (!loteId) return { error: "ID de lote inválido.", aviso: null };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const hectareasRaw = String(formData.get("hectareas") ?? "").trim();
  const fechaSiembraRaw = String(formData.get("fecha_siembra") ?? "").trim();
  const totalArbolesRaw = String(formData.get("total_arboles") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre) return { error: "El nombre del lote es obligatorio.", aviso: null };

  let hectareas: number | null = null;
  if (hectareasRaw) {
    const h = Number(hectareasRaw);
    if (!Number.isFinite(h) || h < 0) {
      return { error: "Hectáreas debe ser un número mayor o igual a cero.", aviso: null };
    }
    hectareas = h;
  }

  let fecha_siembra: Date | null = null;
  if (fechaSiembraRaw) {
    const f = new Date(fechaSiembraRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de siembra inválida.", aviso: null };
    }
    fecha_siembra = f;
  }

  if (!/^\d+$/.test(totalArbolesRaw)) {
    return { error: "Total de árboles debe ser un entero >= 0.", aviso: null };
  }
  const total_arboles = parseInt(totalArbolesRaw, 10);
  if (total_arboles < 0) {
    return { error: "Total de árboles no puede ser negativo.", aviso: null };
  }

  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null, NOT: { id: loteId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya hay otro lote con ese nombre.", aviso: null };
  }

  const arbolesActuales = await prisma.arboles.count({
    where: { lote_id: loteId, deleted_at: null },
  });

  let aviso: string | null = null;

  try {
    await prisma.lotes.update({
      where: { id: loteId },
      data: { nombre, hectareas, fecha_siembra, total_arboles, notas },
    });

    if (total_arboles > arbolesActuales) {
      const desde = arbolesActuales + 1;
      const hasta = total_arboles;
      const data = Array.from({ length: hasta - arbolesActuales }, (_, i) => ({
        lote_id: loteId,
        numero_placa: desde + i,
      }));
      await prisma.arboles.createMany({
        data,
        skipDuplicates: true,
      });
      aviso = `Se generaron ${hasta - arbolesActuales} árboles nuevos (placas ${desde}–${hasta}).`;
    } else if (total_arboles < arbolesActuales) {
      aviso = `Hay ${arbolesActuales - total_arboles} árboles por encima del nuevo total. No se borraron — manejarlos manualmente si es necesario.`;
    }
  } catch (e) {
    return {
      error: `No se pudo actualizar el lote: ${(e as Error)?.message ?? "desconocido"}.`,
      aviso: null,
    };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath("/jefe/lotes");

  if (aviso) {
    return { error: null, aviso };
  }
  redirect(`/jefe/lotes/${loteId}`);
}
