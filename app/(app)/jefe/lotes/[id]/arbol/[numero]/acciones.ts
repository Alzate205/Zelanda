"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null; ok?: boolean };

const ESTADOS_VALIDOS = ["SALUDABLE", "CON_NOVEDAD", "MUERTO", "REMOVIDO"] as const;
type EstadoArbol = (typeof ESTADOS_VALIDOS)[number];

function esEstadoValido(v: string): v is EstadoArbol {
  return (ESTADOS_VALIDOS as readonly string[]).includes(v);
}

export async function actualizarArbol(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");

  const arbolIdRaw = String(formData.get("arbol_id") ?? "");
  if (!/^\d+$/.test(arbolIdRaw)) {
    return { error: "Árbol inválido." };
  }
  const arbolId = BigInt(arbolIdRaw);

  const estadoRaw = String(formData.get("estado") ?? "");
  if (!esEstadoValido(estadoRaw)) {
    return { error: "Estado inválido." };
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  const arbol = await prisma.arboles.findUnique({
    where: { id: arbolId },
    select: { lote_id: true, numero_placa: true },
  });
  if (!arbol) return { error: "Árbol no encontrado." };

  try {
    await prisma.arboles.update({
      where: { id: arbolId },
      data: { estado: estadoRaw, notas },
    });
  } catch (e) {
    return { error: `No se pudo guardar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath(`/jefe/lotes/${arbol.lote_id}/arbol/${arbol.numero_placa}`);
  return { error: null, ok: true };
}
