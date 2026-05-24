"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import type {
  TipoVinculacion,
  TipoPeriodoPago,
  EsquemaPagoDestajo,
} from "@/types";

export type EstadoEdicion = { error: string | null };

function esTipoValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}
function esPeriodoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}
function parsearDestajo(v: string): EsquemaPagoDestajo {
  return v === "ADICIONAL" || v === "REEMPLAZA_DIA" || v === "SOLO_DESTAJO"
    ? (v as EsquemaPagoDestajo)
    : "NUNCA";
}
function esModoValido(v: string): v is "dejar" | "cambiar" | "cerrar" | "editar" {
  return v === "dejar" || v === "cambiar" || v === "cerrar" || v === "editar";
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

  const fechaNacRaw = String(formData.get("fecha_nacimiento") ?? "").trim();
  let fecha_nacimiento: Date | null = null;
  if (fechaNacRaw) {
    const d = new Date(fechaNacRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Fecha de nacimiento inválida." };
    }
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (d > hoy) {
      return { error: "La fecha de nacimiento no puede ser futura." };
    }
    fecha_nacimiento = d;
  }

  const modoRaw = String(formData.get("modo_vinculacion") ?? "dejar");
  if (!esModoValido(modoRaw)) {
    return { error: "Modo de vinculación inválido." };
  }
  const modo = modoRaw;

  await prisma.personas.update({
    where: { id: personaId },
    data: { nombre_completo, cedula, telefono, fecha_nacimiento, notas },
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

  if (modo === "editar") {
    const activas = await prisma.vinculaciones.count({
      where: { persona_id: personaId, fecha_fin: null },
    });
    if (activas === 0) {
      return { error: "No hay vinculación activa para editar." };
    }
    if (activas > 1) {
      return {
        error:
          "Hay más de una vinculación activa para esta persona. Pídele al admin que revise la base de datos.",
      };
    }

    const vincActual = await prisma.vinculaciones.findFirst({
      where: { persona_id: personaId, fecha_fin: null },
      select: { tipo: true },
    });
    if (!vincActual) {
      return { error: "Vinculación activa no encontrada." };
    }
    const tipoActual = vincActual.tipo as TipoVinculacion;

    const rol_finca = String(formData.get("edit_rol_finca") ?? "").trim() || null;
    const salarioRaw = String(formData.get("edit_salario_base") ?? "").trim();
    const periodoRaw = String(formData.get("edit_periodo_pago") ?? "");
    const tarifaRaw = String(formData.get("edit_tarifa_jornal") ?? "").trim();
    const destajoRaw = String(formData.get("edit_esquema_pago_destajo") ?? "");

    let salario_base: number | null = null;
    let periodo_pago: TipoPeriodoPago | null = null;
    let tarifa_jornal: number | null = null;
    const esquema_pago_destajo: EsquemaPagoDestajo | null =
      tipoActual === "FIJO" || tipoActual === "JORNALERO"
        ? parsearDestajo(destajoRaw)
        : null;

    if (tipoActual === "FIJO") {
      const s = Number(salarioRaw.replace(/\./g, ""));
      if (!Number.isFinite(s) || s <= 0) {
        return { error: "Salario base inválido para FIJO." };
      }
      salario_base = s;
      if (!esPeriodoValido(periodoRaw)) {
        return { error: "Período de pago inválido para FIJO." };
      }
      periodo_pago = periodoRaw;
    } else if (tipoActual === "JORNALERO") {
      const t = Number(tarifaRaw.replace(/\./g, ""));
      if (!Number.isFinite(t) || t <= 0) {
        return { error: "Tarifa por jornal inválida para JORNALERO." };
      }
      tarifa_jornal = t;
    }

    await prisma.vinculaciones.updateMany({
      where: { persona_id: personaId, fecha_fin: null },
      data: {
        rol_finca,
        salario_base,
        periodo_pago,
        tarifa_jornal,
        esquema_pago_destajo,
      },
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
  const destajoRaw = String(formData.get("nueva_esquema_pago_destajo") ?? "");

  if (!esTipoValido(tipoRaw)) {
    return { error: "Tipo de vinculación inválido." };
  }
  const tipo = tipoRaw;

  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;
  const esquema_pago_destajo: EsquemaPagoDestajo | null =
    tipo === "FIJO" || tipo === "JORNALERO" ? parsearDestajo(destajoRaw) : null;

  if (tipo === "FIJO") {
    const s = Number(salarioRaw.replace(/\./g, ""));
    if (!Number.isFinite(s) || s <= 0) {
      return { error: "Salario base inválido para FIJO." };
    }
    salario_base = s;
    if (!esPeriodoValido(periodoRaw)) {
      return { error: "Período de pago inválido para FIJO." };
    }
    periodo_pago = periodoRaw;
  } else if (tipo === "JORNALERO") {
    const t = Number(tarifaRaw.replace(/\./g, ""));
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
        esquema_pago_destajo,
      },
    });
  });

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
