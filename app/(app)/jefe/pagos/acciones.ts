"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";
import type { tipo_pago } from "@prisma/client";

export type EstadoPago = { error: string | null };

const TIPOS_VALIDOS: tipo_pago[] = [
  "SALARIO",
  "ADELANTO",
  "JORNAL",
  "SERVICIO",
  "BONO",
  "AJUSTE",
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

export async function crearPago(
  _prev: EstadoPago,
  formData: FormData,
): Promise<EstadoPago> {
  const usuario = await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  const montoRaw = String(formData.get("monto") ?? "").trim();
  const fechaRaw = String(formData.get("fecha") ?? "").trim();
  const metodoPago = String(formData.get("metodo_pago") ?? "").trim();
  const cubreDesdeRaw = String(formData.get("cubre_desde") ?? "").trim();
  const cubreHastaRaw = String(formData.get("cubre_hasta") ?? "").trim();
  const motivoDiferencia = String(formData.get("motivo_diferencia") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!personaId) return { error: "Selecciona a quién se le pagó." };
  if (!TIPOS_VALIDOS.includes(tipoRaw as tipo_pago)) {
    return { error: "Tipo de pago inválido." };
  }
  const tipo = tipoRaw as tipo_pago;

  const monto = Number(montoRaw);
  if (!Number.isFinite(monto)) {
    return { error: "Monto inválido." };
  }
  if (tipo !== "AJUSTE" && monto <= 0) {
    return { error: "El monto debe ser mayor a 0." };
  }
  if (tipo === "AJUSTE" && monto === 0) {
    return { error: "Un ajuste no puede ser 0." };
  }

  if (!fechaRaw) return { error: "Elegí la fecha del pago." };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "Fecha inválida." };
  }

  let cubreDesde: Date | null = null;
  let cubreHasta: Date | null = null;
  if (cubreDesdeRaw || cubreHastaRaw) {
    if (!cubreDesdeRaw || !cubreHastaRaw) {
      return { error: "Si das un periodo cubierto, debe tener desde y hasta." };
    }
    cubreDesde = new Date(`${cubreDesdeRaw}T00:00:00`);
    cubreHasta = new Date(`${cubreHastaRaw}T00:00:00`);
    if (Number.isNaN(cubreDesde.getTime()) || Number.isNaN(cubreHasta.getTime())) {
      return { error: "Periodo cubierto inválido." };
    }
    if (cubreHasta < cubreDesde) {
      return { error: "Hasta no puede ser anterior a Desde." };
    }
  }

  if (tipo === "AJUSTE" && !motivoDiferencia) {
    return { error: "Un ajuste necesita un motivo." };
  }

  try {
    await prisma.pagos.create({
      data: {
        persona_id: personaId,
        monto,
        fecha,
        tipo,
        cubre_desde: cubreDesde,
        cubre_hasta: cubreHasta,
        metodo_pago: metodoPago || null,
        motivo_diferencia: motivoDiferencia || null,
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "pagos/crear") };
  }

  revalidatePath("/jefe/pagos");
  redirect("/jefe/pagos");
}

export async function borrarPago(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.pagos.delete({ where: { id } });
  } catch {
    // best-effort
  }
  revalidatePath("/jefe/pagos");
}
