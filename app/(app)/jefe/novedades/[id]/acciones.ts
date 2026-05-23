"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export type EstadoResolucion = { error: string | null };

export async function marcarResuelta(
  _prev: EstadoResolucion,
  formData: FormData,
): Promise<EstadoResolucion> {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("novedad_id") ?? ""));
  if (!id) return { error: "Novedad inválida." };

  const notas = String(formData.get("notas_resolucion") ?? "").trim();

  try {
    await prisma.novedades.update({
      where: { id },
      data: {
        resuelta: true,
        fecha_resolucion: new Date(),
        notas_resolucion: notas || null,
      },
    });
  } catch {
    return { error: "No se pudo marcar como resuelta." };
  }

  revalidatePath("/jefe/novedades");
  revalidatePath(`/jefe/novedades/${id}`);
  revalidatePath("/jefe");
  redirect("/jefe/novedades");
}

export async function reabrirNovedad(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("novedad_id") ?? ""));
  if (!id) return;

  await prisma.novedades.update({
    where: { id },
    data: {
      resuelta: false,
      fecha_resolucion: null,
      notas_resolucion: null,
    },
  });

  revalidatePath("/jefe/novedades");
  revalidatePath(`/jefe/novedades/${id}`);
  revalidatePath("/jefe");
}
