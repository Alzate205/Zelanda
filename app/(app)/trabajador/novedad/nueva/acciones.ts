"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { subirFoto } from "@/lib/supabase/storage";
import { sanitizarError } from "@/lib/errores";

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

  let novedadId: bigint;
  try {
    const creada = await prisma.novedades.create({
      data: {
        arbol_id: arbol.id,
        persona_id: BigInt(usuario.persona_id),
        tipo: tipoRaw,
        descripcion,
        foto_path,
        resuelta: false,
      },
    });
    novedadId = creada.id;
  } catch (e) {
    return { error: sanitizarError(e, "trabajador/novedad/crear") };
  }

  try {
    const ETIQUETA_NOV: Record<string, string> = {
      PLAGA: "Plaga",
      DANO_FISICO: "Daño físico",
      ENFERMEDAD: "Enfermedad",
      OBSERVACION: "Observación",
      OTRO: "Otro",
    };
    const arbolDetalle = await prisma.arboles.findUnique({
      where: { id: arbol.id },
      select: {
        numero_placa: true,
        lotes: { select: { nombre: true } },
      },
    });
    const jefes = await prisma.usuarios.findMany({
      where: { rol: "JEFE", activo: true },
      select: { id: true },
    });
    if (arbolDetalle && jefes.length > 0) {
      const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
      await enviarPushAUsuarios(
        jefes.map((j) => j.id),
        {
          titulo: `Novedad: ${ETIQUETA_NOV[tipoRaw] ?? tipoRaw}`,
          cuerpo: `Árbol ${arbolDetalle.numero_placa} · Lote ${arbolDetalle.lotes.nombre}`,
          url: `/jefe/novedades/${novedadId}`,
          tag: `novedad-${novedadId}`,
        },
      );
    }
  } catch (e) {
    console.warn("Push novedad falló:", e);
  }

  revalidatePath("/trabajador");
  revalidatePath("/jefe");
  revalidatePath("/jefe/novedades");
  redirect("/trabajador");
}
