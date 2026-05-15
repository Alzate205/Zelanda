"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { subirFoto } from "@/lib/supabase/storage";

export type EstadoNovedad = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function esTipoNovedadValido(v: string): v is "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO" {
  return v === "PLAGA" || v === "DANO_FISICO" || v === "ENFERMEDAD" || v === "OBSERVACION" || v === "OTRO";
}

export async function crearNovedad(
  _prev: EstadoNovedad,
  formData: FormData,
): Promise<EstadoNovedad> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return { error: "Sesión no válida o sin persona vinculada." };
  }

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  const numeroPlaca = String(formData.get("numero_placa") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const foto = formData.get("foto");

  if (!loteId) return { error: "Selecciona un lote." };
  if (!/^\d+$/.test(numeroPlaca)) {
    return { error: "Número de árbol inválido." };
  }
  const placa = parseInt(numeroPlaca, 10);
  if (placa < 1) return { error: "Número de árbol inválido." };
  if (!esTipoNovedadValido(tipoRaw)) return { error: "Tipo de novedad inválido." };
  if (!descripcion) return { error: "La descripción es obligatoria." };

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: loteId, numero_placa: placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol) {
    return { error: `No existe el árbol ${placa} en ese lote. ¿Ya cargó el jefe los árboles?` };
  }

  let foto_path: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const res = await subirFoto(foto, "novedades");
    if ("error" in res) {
      foto_path = null;
    } else {
      foto_path = res.path;
    }
  }

  try {
    await prisma.novedades.create({
      data: {
        arbol_id: arbol.id,
        persona_id: BigInt(usuario.persona_id),
        tipo: tipoRaw,
        descripcion,
        foto_path,
        resuelta: false,
      },
    });
  } catch (e) {
    return { error: `No se pudo guardar: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath("/trabajador");
  revalidatePath("/jefe");
  revalidatePath("/jefe/novedades");
  redirect("/trabajador");
}
