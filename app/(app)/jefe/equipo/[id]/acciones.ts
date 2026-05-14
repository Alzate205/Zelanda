"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import type { TipoVinculacion, TipoPeriodoPago } from "@/types";

export type EstadoEdicion = { error: string | null };

function esTipoValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}
function esPeriodoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}
function esModoValido(v: string): v is "dejar" | "cambiar" | "cerrar" {
  return v === "dejar" || v === "cambiar" || v === "cerrar";
}

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarPersonaYVinculacion(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  if (!personaId) return { error: "ID de persona inválido." };

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre_completo) return { error: "Nombre completo obligatorio." };

  const modoRaw = String(formData.get("modo_vinculacion") ?? "dejar");
  if (!esModoValido(modoRaw)) {
    return { error: "Modo de vinculación inválido." };
  }
  const modo = modoRaw;

  await prisma.personas.update({
    where: { id: personaId },
    data: { nombre_completo, cedula, telefono, notas },
  });

  if (modo === "dejar") {
    revalidatePath(`/jefe/equipo/${personaId}`);
    revalidatePath("/jefe/equipo");
    redirect(`/jefe/equipo/${personaId}`);
  }

  if (modo === "cerrar") {
    await prisma.vinculaciones.updateMany({
      where: { persona_id: personaId, fecha_fin: null },
      data: { fecha_fin: new Date() },
    });
    revalidatePath(`/jefe/equipo/${personaId}`);
    revalidatePath("/jefe/equipo");
    redirect(`/jefe/equipo/${personaId}`);
  }

  // modo === "cambiar"
  const tipoRaw = String(formData.get("nueva_tipo_vinculacion") ?? "");
  const rol_finca = String(formData.get("nueva_rol_finca") ?? "").trim() || null;
  const salarioRaw = String(formData.get("nueva_salario_base") ?? "").trim();
  const periodoRaw = String(formData.get("nueva_periodo_pago") ?? "");
  const tarifaRaw = String(formData.get("nueva_tarifa_jornal") ?? "").trim();

  if (!esTipoValido(tipoRaw)) {
    return { error: "Tipo de vinculación inválido." };
  }
  const tipo = tipoRaw;

  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;

  if (tipo === "FIJO") {
    const s = Number(salarioRaw);
    if (!Number.isFinite(s) || s <= 0) {
      return { error: "Salario base inválido para FIJO." };
    }
    salario_base = s;
    if (!esPeriodoValido(periodoRaw)) {
      return { error: "Período de pago inválido para FIJO." };
    }
    periodo_pago = periodoRaw;
  } else if (tipo === "JORNALERO") {
    const t = Number(tarifaRaw);
    if (!Number.isFinite(t) || t <= 0) {
      return { error: "Tarifa por jornal inválida para JORNALERO." };
    }
    tarifa_jornal = t;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vinculaciones.updateMany({
      where: { persona_id: personaId, fecha_fin: null },
      data: { fecha_fin: new Date() },
    });
    await tx.vinculaciones.create({
      data: {
        persona_id: personaId,
        tipo,
        rol_finca,
        salario_base,
        periodo_pago,
        tarifa_jornal,
      },
    });
  });

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
