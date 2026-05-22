"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { arrayAWktPolygon, type LngLat } from "@/lib/geo";
import { sanitizarError } from "@/lib/errores";

export type EstadoEdicion = { error: string | null };

export async function guardarPoligonoLote(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("lote_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Lote inválido." };
  const verticesRaw = String(formData.get("vertices") ?? "[]");
  let vertices: LngLat[];
  try {
    vertices = JSON.parse(verticesRaw);
  } catch {
    return { error: "Formato de vértices inválido." };
  }
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return { error: "El polígono necesita al menos 3 puntos." };
  }
  for (const v of vertices) {
    if (
      !Array.isArray(v) ||
      v.length !== 2 ||
      typeof v[0] !== "number" ||
      typeof v[1] !== "number"
    ) {
      return { error: "Coordenadas inválidas en algún vértice." };
    }
  }
  let wkt: string;
  try {
    wkt = arrayAWktPolygon(vertices);
  } catch (e) {
    return { error: (e as Error).message };
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE lotes
       SET poligono = ST_GeomFromText($1, 4326)::geography,
           hectareas = ST_Area(ST_GeomFromText($1, 4326)::geography) / 10000,
           updated_at = NOW()
       WHERE id = $2`,
      wkt,
      BigInt(idRaw),
    );
  } catch (e) {
    return { error: sanitizarError(e, "jefe/lotes/poligono/guardar") };
  }

  revalidatePath("/jefe/lotes");
  revalidatePath(`/jefe/lotes/${idRaw}`);
  redirect(`/jefe/lotes/${idRaw}`);
}

export async function quitarPoligonoLote(formData: FormData) {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("lote_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return;
  await prisma.$executeRaw`
    UPDATE lotes SET poligono = NULL, hectareas = NULL, updated_at = NOW()
    WHERE id = ${BigInt(idRaw)}
  `;
  revalidatePath("/jefe/lotes");
  revalidatePath(`/jefe/lotes/${idRaw}`);
  redirect(`/jefe/lotes/${idRaw}/poligono`);
}
