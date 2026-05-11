"use server";

import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { RUTA_INICIO_POR_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/types";

export type EstadoLogin = { error: string | null };

export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirigir = String(formData.get("redirigir") ?? "");

  if (!email || !password) {
    return { error: "Correo y contraseña son obligatorios." };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Credenciales inválidas. Verifica tu correo y contraseña." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No se pudo recuperar la sesión iniciada." };

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (!usuario) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu cuenta aún no está vinculada al sistema. Contacta al jefe de la finca.",
    };
  }

  if (!usuario.activo) {
    await supabase.auth.signOut();
    return { error: "Tu usuario está inactivo. Contacta al jefe de la finca." };
  }

  const destino = redirigir || RUTA_INICIO_POR_ROL[usuario.rol as RolUsuario];
  redirect(destino);
}

export async function cerrarSesion() {
  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
