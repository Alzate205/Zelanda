"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoTipoTarea = { error: string | null };

function esAreaValida(v: string): v is "CULTIVO" | "APICULTURA" {
  return v === "CULTIVO" || v === "APICULTURA";
}

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function leerCampos(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const frecRaw = String(formData.get("frecuencia_dias_default") ?? "").trim();
  const areaRaw = String(formData.get("area") ?? "");
  const color = String(formData.get("color") ?? "").trim() || null;
  const icono = String(formData.get("icono") ?? "").trim() || null;
  return { nombre, descripcion, frecRaw, areaRaw, color, icono };
}

export async function crearTipoTarea(
  _prev: EstadoTipoTarea,
  formData: FormData,
): Promise<EstadoTipoTarea> {
  await requerirUsuario("JEFE");

  const { nombre, descripcion, frecRaw, areaRaw, color, icono } = leerCampos(formData);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!/^\d+$/.test(frecRaw)) {
    return { error: "Frecuencia debe ser un entero positivo." };
  }
  const frecuencia_dias_default = parseInt(frecRaw, 10);
  if (frecuencia_dias_default <= 0) {
    return { error: "Frecuencia debe ser mayor a cero." };
  }
  if (!esAreaValida(areaRaw)) {
    return { error: "Área inválida." };
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Color debe estar en formato #RRGGBB." };
  }

  try {
    await prisma.tipos_tarea.create({
      data: {
        nombre,
        descripcion,
        frecuencia_dias_default,
        area: areaRaw,
        color,
        icono,
        activo: true,
      },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "desconocido";
    if (/unique constraint.*nombre/i.test(msg)) {
      return { error: "Ya existe un tipo de tarea con ese nombre." };
    }
    return { error: `No se pudo crear: ${msg}` };
  }

  revalidatePath("/jefe/tareas");
  redirect("/jefe/tareas");
}

export async function actualizarTipoTarea(
  _prev: EstadoTipoTarea,
  formData: FormData,
): Promise<EstadoTipoTarea> {
  await requerirUsuario("JEFE");

  const tipoId = parsearId(String(formData.get("tipo_id") ?? ""));
  if (!tipoId) return { error: "ID inválido." };

  const { nombre, descripcion, frecRaw, color, icono } = leerCampos(formData);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!/^\d+$/.test(frecRaw)) {
    return { error: "Frecuencia debe ser un entero positivo." };
  }
  const frecuencia_dias_default = parseInt(frecRaw, 10);
  if (frecuencia_dias_default <= 0) {
    return { error: "Frecuencia debe ser mayor a cero." };
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Color debe estar en formato #RRGGBB." };
  }

  const duplicado = await prisma.tipos_tarea.findFirst({
    where: { nombre, NOT: { id: tipoId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya existe otro tipo con ese nombre." };
  }

  try {
    await prisma.tipos_tarea.update({
      where: { id: tipoId },
      data: { nombre, descripcion, frecuencia_dias_default, color, icono },
    });
  } catch (e) {
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath("/jefe/tareas");
  revalidatePath(`/jefe/tareas/${tipoId}/editar`);
  redirect("/jefe/tareas");
}

export async function cambiarEstadoTipo(formData: FormData) {
  await requerirUsuario("JEFE");
  const tipoId = parsearId(String(formData.get("tipo_id") ?? ""));
  if (!tipoId) return;
  const activar = formData.get("activar") === "true";
  await prisma.tipos_tarea.update({
    where: { id: tipoId },
    data: { activo: activar },
  });
  revalidatePath("/jefe/tareas");
}
