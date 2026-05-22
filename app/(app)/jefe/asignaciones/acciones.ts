"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoAsignacion = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function crearAsignacion(
  _prev: EstadoAsignacion,
  formData: FormData,
): Promise<EstadoAsignacion> {
  const usuario = await requerirUsuario("JEFE");

  const destino = String(formData.get("destino") ?? "");
  const loteIdRaw = formData.get("lote_id") ? String(formData.get("lote_id")) : null;
  const apiarioIdRaw = formData.get("apiario_id") ? String(formData.get("apiario_id")) : null;
  const tipoTareaId = parsearId(String(formData.get("tipo_tarea_id") ?? ""));
  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  const fechaInicioRaw = String(formData.get("fecha_inicio") ?? "").trim();

  if (destino !== "lote" && destino !== "apiario") {
    return { error: "Selecciona un destino (lote o apiario)." };
  }
  if (!tipoTareaId) return { error: "Selecciona un tipo de tarea." };
  if (!personaId) return { error: "Selecciona una persona." };

  const loteId = destino === "lote" ? parsearId(loteIdRaw) : null;
  const apiarioId = destino === "apiario" ? parsearId(apiarioIdRaw) : null;

  if (destino === "lote" && !loteId) return { error: "Selecciona un lote válido." };
  if (destino === "apiario" && !apiarioId) return { error: "Selecciona un apiario válido." };

  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: tipoTareaId },
    select: { area: true, activo: true },
  });
  if (!tipo || !tipo.activo) return { error: "Tipo de tarea no válido o inactivo." };

  if (destino === "lote" && tipo.area !== "CULTIVO") {
    return { error: "Tipos de apicultura solo se asignan a apiarios." };
  }
  if (destino === "apiario" && tipo.area !== "APICULTURA") {
    return { error: "Tipos de cultivo solo se asignan a lotes." };
  }

  let fecha_inicio: Date | null = null;
  if (fechaInicioRaw) {
    const f = new Date(fechaInicioRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de inicio inválida." };
    }
    const limite = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (f > limite) {
      return { error: "La fecha de inicio no puede ser de más de un año en el futuro." };
    }
    fecha_inicio = f;
  }

  let nuevaId: bigint;
  try {
    const creada = await prisma.asignaciones.create({
      data: {
        persona_id: personaId,
        lote_id: loteId,
        apiario_id: apiarioId,
        tipo_tarea_id: tipoTareaId,
        fecha_inicio: fecha_inicio ?? new Date(),
        estado: "PENDIENTE",
        creado_por_usuario_id: usuario.id,
      },
    });
    nuevaId = creada.id;
  } catch (e) {
    return { error: sanitizarError(e, "jefe/asignaciones/crear") };
  }

  try {
    const destinatario = await prisma.usuarios.findFirst({
      where: { persona_id: personaId, activo: true },
      select: { id: true },
    });
    if (destinatario) {
      const [tipoTarea, lote, apiario] = await Promise.all([
        prisma.tipos_tarea.findUnique({
          where: { id: tipoTareaId },
          select: { nombre: true },
        }),
        loteId
          ? prisma.lotes.findUnique({
              where: { id: loteId },
              select: { nombre: true },
            })
          : Promise.resolve(null),
        apiarioId
          ? prisma.apiarios.findUnique({
              where: { id: apiarioId },
              select: { nombre: true },
            })
          : Promise.resolve(null),
      ]);
      const ubicacion = lote?.nombre ?? apiario?.nombre ?? "—";
      const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
      await enviarPushAUsuarios([destinatario.id], {
        titulo: "Nueva tarea asignada",
        cuerpo: `${tipoTarea?.nombre ?? "Tarea"} · ${ubicacion}`,
        url: `/trabajador/avance/${nuevaId}`,
        tag: `asignacion-${nuevaId}`,
      });
    }
  } catch (e) {
    console.warn("Push asignación falló:", e);
  }

  revalidatePath("/jefe/asignaciones");
  revalidatePath("/trabajador");
  redirect("/jefe/asignaciones");
}

export async function cancelarAsignacion(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: "CANCELADA" },
  });
  revalidatePath("/jefe/asignaciones");
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath("/trabajador");
}

export async function reabrirAsignacion(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: "EN_CURSO", fecha_completada: null },
  });
  revalidatePath("/jefe/asignaciones");
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath("/trabajador");
}
