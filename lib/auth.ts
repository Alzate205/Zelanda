import "server-only";
import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "./supabase/server";
import { RUTA_INICIO_POR_ROL } from "./constantes";
import type { RolUsuario } from "@/types";

export type UsuarioActual = {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  persona_id: number | null;
  activo: boolean;
};

export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre_completo, rol, persona_id, activo")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as UsuarioActual;
}

/**
 * Para usar en layouts/páginas server-side: redirige a /login si no hay
 * sesión, y a la home del rol propio si el rol no coincide con el requerido.
 */
export async function requerirUsuario(
  rolRequerido?: RolUsuario,
): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !usuario.activo) {
    redirect("/login");
  }
  if (rolRequerido && usuario.rol !== rolRequerido) {
    redirect(RUTA_INICIO_POR_ROL[usuario.rol]);
  }
  return usuario;
}
