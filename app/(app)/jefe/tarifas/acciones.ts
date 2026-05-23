"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";
import type { esquema_pago_actividad } from "@prisma/client";

export type EstadoTarifa = { error: string | null };

const ESQUEMAS_VALIDOS: esquema_pago_actividad[] = [
  "POR_JORNAL",
  "POR_KG",
  "POR_ARBOL",
  "POR_HECTAREA",
  "POR_HORA",
  "OTRO",
];

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearTarifa(
  _prev: EstadoTarifa,
  formData: FormData,
): Promise<EstadoTarifa> {
  const usuario = await requerirUsuario("JEFE");

  const tipoTareaId = parsearId(String(formData.get("tipo_tarea_id") ?? ""));
  const esquemaRaw = String(formData.get("esquema_pago") ?? "").trim();
  const montoRaw = String(formData.get("monto") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "").trim();
  const desdeRaw = String(formData.get("vigente_desde") ?? "").trim();
  const hastaRaw = String(formData.get("vigente_hasta") ?? "").trim();
  const loteIdRaw = String(formData.get("lote_id") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!tipoTareaId) return { error: "Selecciona un tipo de tarea." };
  if (!ESQUEMAS_VALIDOS.includes(esquemaRaw as esquema_pago_actividad)) {
    return { error: "Esquema de pago inválido." };
  }
  const monto = Number(montoRaw);
  if (!Number.isFinite(monto) || monto < 0) {
    return { error: "Monto inválido." };
  }
  if (!desdeRaw) return { error: "Elegí la fecha desde la cual rige." };
  const desde = new Date(`${desdeRaw}T00:00:00`);
  if (Number.isNaN(desde.getTime())) {
    return { error: "Fecha desde inválida." };
  }
  let hasta: Date | null = null;
  if (hastaRaw) {
    hasta = new Date(`${hastaRaw}T00:00:00`);
    if (Number.isNaN(hasta.getTime())) {
      return { error: "Fecha hasta inválida." };
    }
    if (hasta < desde) {
      return { error: "Hasta no puede ser anterior a Desde." };
    }
  }
  const loteId = loteIdRaw ? parsearId(loteIdRaw) : null;
  if (loteIdRaw && !loteId) return { error: "Lote inválido." };

  try {
    await prisma.tarifas_tarea.create({
      data: {
        tipo_tarea_id: tipoTareaId,
        esquema_pago: esquemaRaw as esquema_pago_actividad,
        monto,
        unidad: unidad || null,
        vigente_desde: desde,
        vigente_hasta: hasta,
        lote_id: loteId,
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "tarifas/crear") };
  }

  revalidatePath("/jefe/tarifas");
  redirect("/jefe/tarifas");
}

export async function cerrarTarifa(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const existente = await prisma.tarifas_tarea.findUnique({
    where: { id },
    select: { vigente_desde: true, vigente_hasta: true },
  });
  if (!existente || existente.vigente_hasta) return;
  const cierre = existente.vigente_desde > hoy ? existente.vigente_desde : hoy;
  await prisma.tarifas_tarea.update({
    where: { id },
    data: { vigente_hasta: cierre },
  });
  revalidatePath("/jefe/tarifas");
}

export async function borrarTarifa(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.tarifas_tarea.delete({ where: { id } });
  } catch {
    // best-effort
  }
  revalidatePath("/jefe/tarifas");
}
