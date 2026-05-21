"use server";

import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { RUTA_INICIO_POR_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/types";

export type EstadoLogin = { error: string | null };

async function resolverEmail(identificador: string): Promise<string | null> {
  if (identificador.includes("@")) return identificador;

  // Buscar el email por username usando service role (bypassea RLS).
  const admin = crearClienteSupabaseAdmin();
  const { data, error } = await admin
    .from("usuarios")
    .select("email")
    .eq("username", identificador)
    .maybeSingle();

  if (error || !data) return null;
  return data.email;
}

export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const identificadorRaw = String(formData.get("identificador") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirigir = String(formData.get("redirigir") ?? "");

  if (!identificadorRaw || !password) {
    return { error: "Usuario y contraseña son obligatorios." };
  }

  const email = await resolverEmail(identificadorRaw);
  if (!email) {
    return {
      error: "Credenciales inválidas. Verifica tu usuario y contraseña.",
    };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: "Credenciales inválidas. Verifica tu usuario y contraseña.",
    };
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
