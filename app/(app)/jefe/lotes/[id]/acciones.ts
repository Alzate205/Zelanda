"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoEdicionLote = { error: string | null; aviso: string | null };
export type EstadoSiembra = { error: string | null; aviso: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function aplicarFechaSiembraArboles(
  _prev: EstadoSiembra,
  formData: FormData,
): Promise<EstadoSiembra> {
  await requerirUsuario("JEFE");

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  if (!loteId) return { error: "ID de lote inválido.", aviso: null };

  const modo = String(formData.get("modo") ?? "");
  if (modo !== "lote" && modo !== "lapso") {
    return { error: "Modo inválido.", aviso: null };
  }

  const sobrescribir = String(formData.get("sobrescribir") ?? "") === "on";

  if (modo === "lote") {
    const lote = await prisma.lotes.findUnique({
      where: { id: loteId },
      select: { fecha_siembra: true },
    });
    if (!lote?.fecha_siembra) {
      return {
        error: "Primero define una fecha de siembra para el lote.",
        aviso: null,
      };
    }
    const where = sobrescribir
      ? { lote_id: loteId, deleted_at: null }
      : { lote_id: loteId, deleted_at: null, fecha_siembra: null };
    const r = await prisma.arboles.updateMany({
      where,
      data: { fecha_siembra: lote.fecha_siembra },
    });
    revalidatePath(`/jefe/lotes/${loteId}`);
    return {
      error: null,
      aviso: `Se aplicó la fecha del lote a ${r.count} árbol${r.count === 1 ? "" : "es"}.`,
    };
  }

  const desdeRaw = String(formData.get("desde") ?? "").trim();
  const hastaRaw = String(formData.get("hasta") ?? "").trim();
  if (!desdeRaw || !hastaRaw) {
    return { error: "Ingresá ambas fechas (desde y hasta).", aviso: null };
  }
  const desde = new Date(desdeRaw);
  const hasta = new Date(hastaRaw);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    return { error: "Fechas inválidas.", aviso: null };
  }
  if (desde.getTime() > hasta.getTime()) {
    return { error: "La fecha desde no puede ser mayor que hasta.", aviso: null };
  }

  const arboles = await prisma.arboles.findMany({
    where: sobrescribir
      ? { lote_id: loteId, deleted_at: null }
      : { lote_id: loteId, deleted_at: null, fecha_siembra: null },
    select: { id: true, numero_placa: true },
    orderBy: { numero_placa: "asc" },
  });

  if (arboles.length === 0) {
    return {
      error: null,
      aviso: "No hay árboles para actualizar (todos ya tienen fecha o no hay árboles cargados).",
    };
  }

  const inicioMs = desde.getTime();
  const finMs = hasta.getTime();
  const n = arboles.length;

  const actualizaciones = arboles.map((a, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const ms = inicioMs + (finMs - inicioMs) * t;
    return prisma.arboles.update({
      where: { id: a.id },
      data: { fecha_siembra: new Date(ms) },
    });
  });

  try {
    await prisma.$transaction(actualizaciones);
  } catch (e) {
    return {
      error: sanitizarError(e, "jefe/lotes/aplicar-lapso"),
      aviso: null,
    };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  return {
    error: null,
    aviso: `Se distribuyó la fecha de siembra entre ${n} árbol${n === 1 ? "" : "es"} desde ${desdeRaw} hasta ${hastaRaw}.`,
  };
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
      error: sanitizarError(e, "jefe/lotes/actualizar"),
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
