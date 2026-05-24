"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";
import type { estado_servicio } from "@prisma/client";

export type EstadoServicio = { error: string | null };

const ESTADOS_VALIDOS: estado_servicio[] = [
  "ACUERDO",
  "EN_CURSO",
  "TERMINADO",
  "CANCELADO",
];

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

async function crearPersonaBasica(nombreCompleto: string): Promise<bigint> {
  const MAX_INTENTOS = 5;
  let intentos = 0;
  while (true) {
    intentos++;
    const filas = await prisma.$queryRaw<{ next_id: bigint }[]>`
      SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas
    `;
    const nextId = filas[0].next_id;
    try {
      const p = await prisma.personas.create({
        data: {
          id: nextId,
          nombre_completo: nombreCompleto,
          activo: true,
        },
      });
      return p.id;
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (
        /unique constraint.*pkey|unique constraint.*"personas_pkey"/i.test(msg) &&
        intentos < MAX_INTENTOS
      ) {
        continue;
      }
      throw e;
    }
  }
}

export async function crearServicio(
  _prev: EstadoServicio,
  formData: FormData,
): Promise<EstadoServicio> {
  const usuario = await requerirUsuario("JEFE");

  const personaIdExistente = parsearId(
    String(formData.get("persona_id") ?? ""),
  );
  const nuevoContratistaNombre = String(
    formData.get("nuevo_contratista_nombre") ?? "",
  ).trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const loteIdRaw = String(formData.get("lote_id") ?? "").trim();
  const montoRaw = String(formData.get("monto_pactado") ?? "").trim();
  const fechaInicioRaw = String(formData.get("fecha_inicio") ?? "").trim();
  const fechaFinRaw = String(formData.get("fecha_fin") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!personaIdExistente && !nuevoContratistaNombre) {
    return { error: "Elegí al contratista o escribí el nombre." };
  }
  if (!descripcion) return { error: "Describí el servicio." };

  const monto = Number(montoRaw.replace(/\./g, ""));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "Monto pactado inválido." };
  }

  if (!fechaInicioRaw) return { error: "Elegí la fecha de inicio." };
  const fechaInicio = new Date(`${fechaInicioRaw}T00:00:00`);
  if (Number.isNaN(fechaInicio.getTime())) {
    return { error: "Fecha de inicio inválida." };
  }

  let fechaFin: Date | null = null;
  if (fechaFinRaw) {
    fechaFin = new Date(`${fechaFinRaw}T00:00:00`);
    if (Number.isNaN(fechaFin.getTime())) {
      return { error: "Fecha de fin inválida." };
    }
    if (fechaFin < fechaInicio) {
      return { error: "Fin no puede ser anterior a Inicio." };
    }
  }

  const loteId = loteIdRaw ? parsearId(loteIdRaw) : null;
  if (loteIdRaw && !loteId) return { error: "Lote inválido." };

  try {
    const personaId = personaIdExistente
      ? personaIdExistente
      : await crearPersonaBasica(nuevoContratistaNombre);

    await prisma.servicios_contratados.create({
      data: {
        persona_id: personaId,
        descripcion,
        lote_id: loteId,
        monto_pactado: monto,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: "ACUERDO",
        notas: notas || null,
        registrado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, "servicios/crear") };
  }

  revalidatePath("/jefe/servicios");
  redirect("/jefe/servicios");
}

export async function cambiarEstadoServicio(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  const nuevoEstadoRaw = String(formData.get("estado") ?? "").trim();
  if (!id) return;
  if (!ESTADOS_VALIDOS.includes(nuevoEstadoRaw as estado_servicio)) return;
  await prisma.servicios_contratados.update({
    where: { id },
    data: { estado: nuevoEstadoRaw as estado_servicio },
  });
  revalidatePath("/jefe/servicios");
  revalidatePath(`/jefe/servicios/${id}`);
}

export async function borrarServicio(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  try {
    await prisma.servicios_contratados.delete({ where: { id } });
  } catch {
    // best-effort: puede fallar si hay pagos relacionados que no son SET NULL
  }
  revalidatePath("/jefe/servicios");
  redirect("/jefe/servicios");
}
