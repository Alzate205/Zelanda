"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import type { RolUsuario } from "@/types";

export type EstadoFormulario = {
  error: string | null;
  exito: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === "JEFE" || v === "BODEGA" || v === "ALMACEN" || v === "TRABAJADOR";
}

export async function crearMiembro(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirUsuario("JEFE");

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const rol_finca = String(formData.get("rol_finca") ?? "").trim();
  const es_apicultor = formData.get("es_apicultor") === "on";
  const notas = String(formData.get("notas") ?? "").trim() || null;

  const crear_acceso = formData.get("crear_acceso") === "on";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol_app_raw = String(formData.get("rol_app") ?? "");

  if (!nombre_completo) return { ...ESTADO_INICIAL, error: "El nombre completo es obligatorio." };
  if (!rol_finca) return { ...ESTADO_INICIAL, error: "El rol en la finca es obligatorio." };

  let rol_app: RolUsuario | null = null;
  if (crear_acceso) {
    if (!email || !email.includes("@")) {
      return { ...ESTADO_INICIAL, error: "Email inválido para crear acceso." };
    }
    if (!password || password.length < 8) {
      return {
        ...ESTADO_INICIAL,
        error: "La contraseña debe tener al menos 8 caracteres.",
      };
    }
    if (!esRolValido(rol_app_raw)) {
      return {
        ...ESTADO_INICIAL,
        error: "Selecciona un rol válido para el acceso (JEFE/BODEGA/ALMACEN/TRABAJADOR).",
      };
    }
    rol_app = rol_app_raw;
  }

  // 1) Crear el trabajador SIEMPRE. La creación de acceso opcional se hace después.
  let trabajadorIdCreado: bigint;
  try {
    const t = await prisma.trabajadores.create({
      data: {
        nombre_completo,
        cedula,
        telefono,
        rol_finca,
        es_apicultor,
        notas,
        activo: true,
      },
    });
    trabajadorIdCreado = t.id;
  } catch (e) {
    const msg = (e as Error)?.message ?? "Error desconocido";
    if (/unique constraint.*cedula/i.test(msg)) {
      return { ...ESTADO_INICIAL, error: "Ya existe un trabajador con esa cédula." };
    }
    return { ...ESTADO_INICIAL, error: `No se pudo crear el trabajador: ${msg}` };
  }

  if (!crear_acceso) {
    revalidatePath("/jefe/equipo");
    redirect("/jefe/equipo");
  }

  // 2) Crear el usuario en Supabase Auth.
  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo },
  });

  if (authError || !authData?.user) {
    // Rollback: borrar el trabajador para no dejar huérfanos.
    await prisma.trabajadores.delete({ where: { id: trabajadorIdCreado } }).catch(() => {});
    const yaRegistrado = /already registered|already exists/i.test(authError?.message ?? "");
    return {
      ...ESTADO_INICIAL,
      error: yaRegistrado
        ? "Ese correo ya está registrado en el sistema."
        : `Error al crear el acceso: ${authError?.message ?? "desconocido"}.`,
    };
  }

  // 3) Insertar fila en `usuarios` enlazando al trabajador.
  try {
    await prisma.usuarios.create({
      data: {
        id: authData.user.id,
        email,
        nombre_completo,
        rol: rol_app!,
        trabajador_id: trabajadorIdCreado,
        activo: true,
      },
    });
  } catch (e) {
    // Rollback: borrar auth user y trabajador.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    await prisma.trabajadores.delete({ where: { id: trabajadorIdCreado } }).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo enlazar el acceso: ${(e as Error)?.message ?? "error desconocido"}.`,
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

  await prisma.trabajadores.update({
    where: { id },
    data: { activo: activar },
  });

  // Si tiene usuario asociado, marcarlo igual.
  await prisma.usuarios.updateMany({
    where: { trabajador_id: id },
    data: { activo: activar },
  });

  revalidatePath("/jefe/equipo");
}
