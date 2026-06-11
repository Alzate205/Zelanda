import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteSupabaseServidor } from './supabase/server';
import { RUTA_INICIO_POR_ROL } from './constantes';
import type { RolUsuario } from '@/types';

export type UsuarioActual = {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  persona_id: number | null;
  activo: boolean;
};

/**
 * Cacheado por petición con cache() de React: layout y página comparten
 * una sola verificación. getClaims() valida el JWT localmente cuando el
 * proyecto usa llaves asimétricas (cero viajes a Supabase Auth); el
 * refresh del token sigue a cargo del middleware.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const supabase = await crearClienteSupabaseServidor();
  const { data: claimsData, error: errorClaims } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (errorClaims || !sub) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre_completo, rol, persona_id, activo')
    .eq('id', sub)
    .single();

  if (error || !data) return null;
  return data as UsuarioActual;
});

/**
 * Para usar en layouts/páginas server-side: redirige a /login si no hay
 * sesión, y a la home del rol propio si el rol no coincide con el requerido.
 */
export async function requerirUsuario(rolRequerido?: RolUsuario): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !usuario.activo) {
    redirect('/login');
  }
  if (rolRequerido && usuario.rol !== rolRequerido) {
    redirect(RUTA_INICIO_POR_ROL[usuario.rol]);
  }
  return usuario;
}
