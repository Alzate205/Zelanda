"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

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
    return { ...ESTADO_INICIAL, error: `No se pudo guardar: ${msg}` };
  }

  revalidatePath("/mi-perfil");
  return { error: null, exito: "Datos guardados." };
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
