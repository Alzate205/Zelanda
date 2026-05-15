import "server-only";
import { crearClienteSupabaseServidor } from "./server";

const BUCKET = "fotos";

export async function subirFoto(
  file: File,
  carpeta: "novedades" | "avance",
): Promise<{ path: string } | { error: string }> {
  const supabase = await crearClienteSupabaseServidor();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${carpeta}/${ts}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) return { error: error.message };
  return { path };
}

export async function urlFotoFirmada(
  path: string,
  segundos = 60 * 60,
): Promise<string | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, segundos);
  return data?.signedUrl ?? null;
}
