"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

export async function crearCosecha(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("ALMACEN");

  const personaIdRaw = String(formData.get("persona_id") ?? "");
  const loteIdRaw = String(formData.get("lote_id") ?? "");
  const metodo = String(formData.get("metodo") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!/^\d+$/.test(personaIdRaw)) return { error: "Recolector inválido." };
  if (!/^\d+$/.test(loteIdRaw)) return { error: "Lote inválido." };
  if (metodo !== "CANASTA" && metodo !== "BASCULA") {
    return { error: "Método de medición inválido." };
  }

  let pesoKg: number;
  let cantidadCanastas: number | null = null;
  let capacidadCanastaKg: number | null = null;

  if (metodo === "CANASTA") {
    const cRaw = String(formData.get("cantidad_canastas") ?? "").trim();
    const capRaw = String(formData.get("capacidad_canasta_kg") ?? "").trim();
    const c = Number(cRaw);
    const cap = Number(capRaw);
    if (!Number.isInteger(c) || c <= 0) {
      return { error: "Cantidad de canastas debe ser un entero positivo." };
    }
    if (!Number.isFinite(cap) || cap <= 0) {
      return { error: "Capacidad de canasta debe ser positiva." };
    }
    cantidadCanastas = c;
    capacidadCanastaKg = cap;
    pesoKg = c * cap;
  } else {
    const pRaw = String(formData.get("peso_kg") ?? "").trim();
    const p = Number(pRaw);
    if (!Number.isFinite(p) || p <= 0) {
      return { error: "Peso debe ser positivo." };
    }
    pesoKg = p;
  }

  try {
    await prisma.cosechas.create({
      data: {
        persona_id: BigInt(personaIdRaw),
        lote_id: BigInt(loteIdRaw),
        recibido_por_usuario_id: usuario.id,
        metodo_medicion: metodo,
        cantidad_canastas: cantidadCanastas,
        capacidad_canasta_kg: capacidadCanastaKg,
        peso_kg: pesoKg,
        notas,
      },
    });
  } catch (e) {
    return { error: `No se pudo registrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/almacen");
  revalidatePath("/almacen/cosecha");
  redirect("/almacen/cosecha");
}
