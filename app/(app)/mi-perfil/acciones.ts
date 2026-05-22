"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { sanitizarError } from "@/lib/errores";

export type EstadoPerfil = { error: string | null; exito: string | null };

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

export async function actualizarMisDatos(
  _prev: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, error: "Sesión no válida." };

  if (usuario.persona_id === null) {
    return {
      ...ESTADO_INICIAL,
      error:
        "Tu cuenta no está vinculada a una persona. Pídele al jefe que te asocie.",
    };
  }

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre_completo) {
    return { ...ESTADO_INICIAL, error: "El nombre completo es obligatorio." };
  }

  try {
    await prisma.personas.update({
      where: { id: BigInt(usuario.persona_id) },
      data: { nombre_completo, cedula, telefono, notas },
    });
    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: { nombre_completo },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "desconocido";
    if (/unique constraint.*cedula/i.test(msg)) {
      return { ...ESTADO_INICIAL, error: "Esa cédula ya está registrada." };
    }
    return { ...ESTADO_INICIAL, error: sanitizarError(e, "mi-perfil/actualizar-datos") };
  }

  revalidatePath("/mi-perfil");
  return { error: null, exito: "Datos guardados." };
}

export async function actualizarMiUsername(
  _prev: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, error: "Sesión no válida." };

  const raw = String(formData.get("username") ?? "").trim().toLowerCase();
  const username = raw || null;

  if (username !== null) {
    if (username.length < 3) {
      return {
        ...ESTADO_INICIAL,
        error: "El usuario debe tener al menos 3 caracteres.",
      };
    }
    if (username.length > 30) {
      return {
        ...ESTADO_INICIAL,
        error: "El usuario no puede tener más de 30 caracteres.",
      };
    }
    if (!/^[a-z0-9_.-]+$/.test(username)) {
      return {
        ...ESTADO_INICIAL,
        error:
          "Solo letras minúsculas, números y los símbolos _ . - (sin espacios ni @).",
      };
    }
  }

  try {
    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: { username },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "desconocido";
    if (/unique/i.test(msg)) {
      return {
        ...ESTADO_INICIAL,
        error: "Ese nombre de usuario ya está en uso. Probá otro.",
      };
    }
    return { ...ESTADO_INICIAL, error: sanitizarError(e, "mi-perfil/actualizar-username") };
  }

  revalidatePath("/mi-perfil");
  return {
    error: null,
    exito: username
      ? `Ahora podés entrar con el usuario "${username}".`
      : "Usuario eliminado. Solo podrás entrar con tu correo.",
  };
}

export async function cambiarMiContrasena(
  _prev: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, error: "Sesión no válida." };

  const nueva = String(formData.get("contrasena_nueva") ?? "");
  const confirmacion = String(formData.get("contrasena_confirmacion") ?? "");

  if (nueva.length < 8) {
    return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (nueva !== confirmacion) {
    return { ...ESTADO_INICIAL, error: "Las contraseñas no coinciden." };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    return { ...ESTADO_INICIAL, error: `No se pudo cambiar: ${error.message}` };
  }

  return { error: null, exito: "Contraseña actualizada." };
}
