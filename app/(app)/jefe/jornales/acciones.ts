"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoJornal = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearJornal(
  _prev: EstadoJornal,
  formData: FormData,
): Promise<EstadoJornal> {
  const usuario = await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  const fechaRaw = String(formData.get("fecha") ?? "").trim();
  const tarifaRaw = String(formData.get("tarifa_aplicada") ?? "").trim();
  const loteIdRaw = String(formData.get("lote_id") ?? "").trim();
  const descripcion = String(formData.get("descripcion_actividad") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!personaId) return { error: "Selecciona la persona." };

  if (!fechaRaw) return { error: "Elegí la fecha." };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "Fecha inválida." };
  }

  const tarifa = Number(tarifaRaw.replace(/\./g, ""));
  if (!Number.isFinite(tarifa) || tarifa < 0) {
    return { error: "Tarifa inválida." };
  }

  const loteId = loteIdRaw ? parsearId(loteIdRaw) : null;
  if (loteIdRaw && !loteId) return { error: "Lote inválido." };

  try {
    await prisma.jornales.create({
      data: {
        persona_id: personaId,
        fecha,
        tarifa_aplicada: tarifa,
        lote_id: loteId,
        descripcion_actividad: descripcion || null,
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (/unique constraint.*persona_id.*fecha|jornales_persona_id_fecha_key/i.test(msg)) {
      return {
        error:
          "Ya hay un jornal registrado para esta persona en esa fecha. Borralo primero si querés cambiarlo.",
      };
    }
    return { error: sanitizarError(e, "jornales/crear") };
  }

  revalidatePath("/jefe/jornales");
  redirect("/jefe/jornales");
}

export async function borrarJornal(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.jornales.delete({ where: { id } });
  } catch {
    // best-effort
  }
  revalidatePath("/jefe/jornales");
}
