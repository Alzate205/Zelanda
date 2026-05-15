"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function marcarResuelta(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("novedad_id") ?? ""));
  if (!id) return;

  await prisma.novedades.update({
    where: { id },
    data: { resuelta: true, fecha_resolucion: new Date() },
  });

  revalidatePath("/jefe/novedades");
  revalidatePath("/jefe");
  redirect("/jefe/novedades");
}
