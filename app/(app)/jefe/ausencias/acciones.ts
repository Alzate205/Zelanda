"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";
import type { tipo_ausencia } from "@prisma/client";

export type EstadoAusencia = { error: string | null };

const TIPOS_VALIDOS: tipo_ausencia[] = [
  "FALTA_INJUSTIFICADA",
  "INCAPACIDAD",
  "VACACIONES",
  "LICENCIA",
  "PERMISO",
];

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearAusencia(
  _prev: EstadoAusencia,
  formData: FormData,
): Promise<EstadoAusencia> {
  const usuario = await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  const fechaRaw = String(formData.get("fecha") ?? "").trim();
  const descontable = String(formData.get("descontable") ?? "") === "on";
  const observaciones = String(formData.get("observaciones") ?? "").trim();

  if (!personaId) return { error: "Selecciona la persona." };
  if (!TIPOS_VALIDOS.includes(tipoRaw as tipo_ausencia)) {
    return { error: "Tipo de ausencia inválido." };
  }
  const tipo = tipoRaw as tipo_ausencia;

  if (!fechaRaw) return { error: "Elegí la fecha." };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "Fecha inválida." };
  }

  try {
    await prisma.ausencias.create({
      data: {
        persona_id: personaId,
        fecha,
        tipo,
        descontable,
        observaciones: observaciones || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (
      /unique constraint.*persona_id.*fecha|ausencias_persona_id_fecha_key/i.test(
        msg,
      )
    ) {
      return {
        error:
          "Ya hay una ausencia registrada para esta persona en esa fecha. Borrala primero si querés cambiarla.",
      };
    }
    return { error: sanitizarError(e, "ausencias/crear") };
  }

  revalidatePath("/jefe/ausencias");
  redirect("/jefe/ausencias");
}

export async function borrarAusencia(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.ausencias.delete({ where: { id } });
  } catch {
    // best-effort
  }
  revalidatePath("/jefe/ausencias");
}
