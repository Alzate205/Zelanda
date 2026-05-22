"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import type { RolUsuario } from "@/types";

export type EstadoAcceso = { error: string | null; exito: string | null };
const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === "JEFE" || v === "BODEGA" || v === "ALMACEN" || v === "TRABAJADOR";
}

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function crearAccesoParaPersona(
  _prev: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  if (!personaId) return { ...ESTADO_INICIAL, error: "ID de persona inválido." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rolRaw = String(formData.get("rol") ?? "");

  if (!email.includes("@")) {
    return { ...ESTADO_INICIAL, error: "Correo inválido." };
  }
  if (password.length < 8) {
    return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!esRolValido(rolRaw)) {
    return { ...ESTADO_INICIAL, error: "Rol inválido." };
  }
  const rol = rolRaw;

  const persona = await prisma.personas.findUnique({
    where: { id: personaId },
    include: { usuarios: { select: { id: true } } },
  });
  if (!persona || persona.deleted_at) {
    return { ...ESTADO_INICIAL, error: "Persona no encontrada." };
  }
  if (persona.usuarios.length > 0) {
    return { ...ESTADO_INICIAL, error: "Esta persona ya tiene acceso al sistema." };
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: persona.nombre_completo },
  });

  if (authError || !authData?.user) {
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
        nombre_completo: persona.nombre_completo,
        rol,
        persona_id: personaId,
        activo: true,
      },
    });
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo enlazar el acceso: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
