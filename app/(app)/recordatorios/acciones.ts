"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { sanitizarError } from "@/lib/errores";

export type EstadoRecordatorio = {
  error: string | null;
  exito: string | null;
};

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearRecordatorio(
  _prev: EstadoRecordatorio,
  formData: FormData,
): Promise<EstadoRecordatorio> {
  const usuario = await requerirUsuario();
  if (usuario.persona_id === null) {
    return {
      error: "Tu usuario no está vinculado a una persona.",
      exito: null,
    };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const fechaRaw = String(formData.get("fecha") ?? "").trim();
  const asignadoRaw = String(formData.get("asignado_a_persona_id") ?? "").trim();

  if (!titulo) return { error: "Escribí un título.", exito: null };
  if (!fechaRaw) return { error: "Elegí una fecha.", exito: null };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "Fecha inválida.", exito: null };
  }

  // Asignado: si no se manda, es para uno mismo
  let asignadoId = BigInt(usuario.persona_id);
  if (asignadoRaw) {
    const parsed = parsearId(asignadoRaw);
    if (!parsed) return { error: "Persona inválida.", exito: null };
    // Solo el JEFE puede asignar a otra persona
    if (
      parsed !== BigInt(usuario.persona_id) &&
      usuario.rol !== "JEFE"
    ) {
      return {
        error: "Solo el jefe puede asignar recordatorios a otra persona.",
        exito: null,
      };
    }
    asignadoId = parsed;
  }

  try {
    const r = await prisma.recordatorios.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        fecha,
        asignado_a_persona_id: asignadoId,
        creado_por_persona_id: BigInt(usuario.persona_id),
        creado_por_usuario_id: usuario.id,
      },
      select: { id: true, asignado_a_persona_id: true },
    });

    // Push best-effort si se asignó a otra persona y la fecha es hoy
    try {
      if (r.asignado_a_persona_id !== BigInt(usuario.persona_id)) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        if (fecha >= hoy && fecha < manana) {
          const destinatario = await prisma.usuarios.findFirst({
            where: { persona_id: r.asignado_a_persona_id, activo: true },
            select: { id: true },
          });
          if (destinatario) {
            const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
            await enviarPushAUsuarios([destinatario.id], {
              titulo: "Recordatorio para hoy",
              cuerpo: titulo,
              url: "/recordatorios",
              tag: `recordatorio-${r.id}`,
            });
            await prisma.recordatorios.update({
              where: { id: r.id },
              data: { push_enviado_en: new Date() },
            });
          }
        }
      }
    } catch (e) {
      console.warn("Push recordatorio falló:", e);
    }
  } catch (e) {
    return { error: sanitizarError(e, "recordatorios/crear"), exito: null };
  }

  revalidatePath("/recordatorios");
  revalidatePath("/jefe");
  revalidatePath("/trabajador");
  redirect("/recordatorios");
}

export async function marcarRecordatorioHecho(formData: FormData) {
  const usuario = await requerirUsuario();
  if (usuario.persona_id === null) return;

  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  const rec = await prisma.recordatorios.findUnique({
    where: { id },
    select: {
      asignado_a_persona_id: true,
      creado_por_persona_id: true,
      completado_en: true,
    },
  });
  if (!rec || rec.completado_en) return;

  // Puede marcarlo: el asignado, el creador, o el jefe
  const personaId = BigInt(usuario.persona_id);
  const autorizado =
    usuario.rol === "JEFE" ||
    rec.asignado_a_persona_id === personaId ||
    rec.creado_por_persona_id === personaId;
  if (!autorizado) return;

  await prisma.recordatorios.update({
    where: { id },
    data: {
      completado_en: new Date(),
      completado_por_persona_id: personaId,
      notas_completado: notas,
    },
  });

  revalidatePath("/recordatorios");
  revalidatePath("/jefe");
  revalidatePath("/trabajador");
}

export async function reabrirRecordatorio(formData: FormData) {
  const usuario = await requerirUsuario();
  if (usuario.persona_id === null) return;

  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;

  const rec = await prisma.recordatorios.findUnique({
    where: { id },
    select: {
      asignado_a_persona_id: true,
      creado_por_persona_id: true,
    },
  });
  if (!rec) return;

  const personaId = BigInt(usuario.persona_id);
  const autorizado =
    usuario.rol === "JEFE" ||
    rec.asignado_a_persona_id === personaId ||
    rec.creado_por_persona_id === personaId;
  if (!autorizado) return;

  await prisma.recordatorios.update({
    where: { id },
    data: {
      completado_en: null,
      completado_por_persona_id: null,
      notas_completado: null,
    },
  });

  revalidatePath("/recordatorios");
  revalidatePath("/jefe");
  revalidatePath("/trabajador");
}

export async function borrarRecordatorio(formData: FormData) {
  const usuario = await requerirUsuario();
  if (usuario.persona_id === null) return;

  const id = parsearId(String(formData.get("id") ?? ""));
  if (!id) return;

  const rec = await prisma.recordatorios.findUnique({
    where: { id },
    select: { creado_por_persona_id: true },
  });
  if (!rec) return;

  const personaId = BigInt(usuario.persona_id);
  const autorizado =
    usuario.rol === "JEFE" || rec.creado_por_persona_id === personaId;
  if (!autorizado) return;

  await prisma.recordatorios.delete({ where: { id } });

  revalidatePath("/recordatorios");
  revalidatePath("/jefe");
  revalidatePath("/trabajador");
}
