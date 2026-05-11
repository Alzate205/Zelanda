import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la `service_role` key. Salta RLS — usar SOLO en API
 * routes / Server Actions para tareas administrativas (crear usuarios,
 * jobs internos, etc.). Nunca importar desde código de cliente.
 */
export function crearClienteSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
