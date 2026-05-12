"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import type { RolUsuario, TipoVinculacion, TipoPeriodoPago } from "@/types";

export type EstadoFormulario = {
  error: string | null;
  exito: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === "JEFE" || v === "BODEGA" || v === "ALMACEN" || v === "TRABAJADOR";
}

function esTipoVinculacionValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}

function esPeriodoPagoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}

export async function crearMiembro(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirUsuario("JEFE");

  // --- Datos persona ---
  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  // --- Datos vinculación ---
  const tipoVinculacionRaw = String(formData.get("tipo_vinculacion") ?? "");
  const rol_finca = String(formData.get("rol_finca") ?? "").trim();
  const salarioRaw = String(formData.get("salario_base") ?? "").trim();
  const periodoPagoRaw = String(formData.get("periodo_pago") ?? "");
  const tarifaJornalRaw = String(formData.get("tarifa_jornal") ?? "").trim();

  // --- Acceso ---
  const crear_acceso = formData.get("crear_acceso") === "on";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rolAppRaw = String(formData.get("rol_app") ?? "");

  // --- Validaciones persona ---
  if (!nombre_completo) {
    return { ...ESTADO_INICIAL, error: "El nombre completo es obligatorio." };
  }
  if (!esTipoVinculacionValido(tipoVinculacionRaw)) {
    return { ...ESTADO_INICIAL, error: "Selecciona un tipo de vinculación válido." };
  }
  const tipo = tipoVinculacionRaw;

  // --- Validaciones vinculación según tipo ---
  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;

  if (tipo === "FIJO") {
    if (!salarioRaw) {
      return { ...ESTADO_INICIAL, error: "Salario base obligatorio para tipo FIJO." };
    }
    const s = Number(salarioRaw);
    if (!Number.isFinite(s) || s <= 0) {
      return { ...ESTADO_INICIAL, error: "Salario base debe ser un número positivo." };
    }
    salario_base = s;
    if (!esPeriodoPagoValido(periodoPagoRaw)) {
      return { ...ESTADO_INICIAL, error: "Selecciona un período de pago válido para tipo FIJO." };
    }
    periodo_pago = periodoPagoRaw;
  } else if (tipo === "JORNALERO") {
    if (!tarifaJornalRaw) {
      return { ...ESTADO_INICIAL, error: "Tarifa por jornal obligatoria para tipo JORNALERO." };
    }
    const t = Number(tarifaJornalRaw);
    if (!Number.isFinite(t) || t <= 0) {
      return { ...ESTADO_INICIAL, error: "Tarifa por jornal debe ser un número positivo." };
    }
    tarifa_jornal = t;
  }

  // --- Validaciones acceso ---
  let rol_app: RolUsuario | null = null;
  if (crear_acceso) {
    if (!email || !email.includes("@")) {
      return { ...ESTADO_INICIAL, error: "Email inválido para crear acceso." };
    }
    if (!password || password.length < 8) {
      return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
    }
    if (!esRolValido(rolAppRaw)) {
      return { ...ESTADO_INICIAL, error: "Selecciona un rol válido para el acceso." };
    }
    rol_app = rolAppRaw;
  }

  // --- 1. Crear persona (id manual, BIGINT sin autoincrement post-migración) ---
  const filas = await prisma.$queryRaw<{ next_id: bigint }[]>`
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas
  `;
  const nextId = filas[0].next_id;
  let personaId: bigint;
  try {
    const p = await prisma.personas.create({
      data: {
        id: nextId,
        nombre_completo,
        cedula,
        telefono,
        notas,
        activo: true,
      },
    });
    personaId = p.id;
  } catch (e) {
    const msg = (e as Error)?.message ?? "Error desconocido";
    if (/unique constraint.*cedula/i.test(msg)) {
      return { ...ESTADO_INICIAL, error: "Ya existe una persona con esa cédula." };
    }
    return { ...ESTADO_INICIAL, error: `No se pudo crear la persona: ${msg}` };
  }

  // --- 2. Crear vinculación ---
  try {
    await prisma.vinculaciones.create({
      data: {
        persona_id: personaId,
        tipo,
        rol_finca: rol_finca || null,
        salario_base,
        periodo_pago,
        tarifa_jornal,
      },
    });
  } catch (e) {
    // Rollback persona
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo crear la vinculación: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  // --- 3. Acceso al sistema (opcional) ---
  if (!crear_acceso) {
    revalidatePath("/jefe/equipo");
    redirect("/jefe/equipo");
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo },
  });

  if (authError || !authData?.user) {
    // Rollback: vinculación + persona
    await prisma.vinculaciones.deleteMany({ where: { persona_id: personaId } }).catch(() => {});
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
    const yaRegistrado = /already registered|already exists/i.test(authError?.message ?? "");
    return {
      ...ESTADO_INICIAL,
      error: yaRegistrado
        ? "Ese correo ya está registrado en el sistema."
        : `Error al crear el acceso: ${authError?.message ?? "desconocido"}.`,
    };
  }

  try {
    await prisma.usuarios.create({
      data: {
        id: authData.user.id,
        email,
        nombre_completo,
        rol: rol_app!,
        persona_id: personaId,
        activo: true,
      },
    });
  } catch (e) {
    // Rollback completo
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    await prisma.vinculaciones.deleteMany({ where: { persona_id: personaId } }).catch(() => {});
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo enlazar el acceso: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  revalidatePath("/jefe/equipo");
  redirect("/jefe/equipo");
}

export async function cambiarEstadoMiembro(formData: FormData) {
  await requerirUsuario("JEFE");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";

  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  await prisma.personas.update({
    where: { id },
    data: { activo: activar },
  });

  await prisma.usuarios.updateMany({
    where: { persona_id: id },
    data: { activo: activar },
  });

  revalidatePath("/jefe/equipo");
}
