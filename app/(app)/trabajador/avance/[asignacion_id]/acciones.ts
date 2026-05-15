"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

export type EstadoAvance = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function parsearListaNumeros(raw: string): number[] | null {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n <= 0) return null;
    nums.push(n);
  }
  return nums;
}

export async function registrarAvance(
  _prev: EstadoAvance,
  formData: FormData,
): Promise<EstadoAvance> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "Sesión no válida." };

  const asignacionId = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!asignacionId) return { error: "ID de asignación inválido." };

  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: { lotes: { select: { total_arboles: true } } },
  });
  if (!asignacion) return { error: "Asignación no encontrada." };

  if (usuario.persona_id === null || BigInt(usuario.persona_id) !== asignacion.persona_id) {
    return { error: "No puedes registrar avance en una asignación que no es tuya." };
  }

  if (asignacion.estado !== "PENDIENTE" && asignacion.estado !== "EN_CURSO") {
    return { error: "Esta asignación ya está cerrada." };
  }

  const tipoRegistro = String(formData.get("tipo_registro") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (tipoRegistro === "VISITA") {
    if (asignacion.apiario_id === null) {
      return { error: "VISITA solo aplica a asignaciones de apiario." };
    }
    await prisma.$transaction([
      prisma.registros_avance.create({
        data: {
          asignacion_id: asignacionId,
          persona_id: BigInt(usuario.persona_id),
          tipo_registro: "VISITA",
          cantidad_arboles: 0,
          arboles_lista: [],
          observaciones,
        },
      }),
      prisma.asignaciones.update({
        where: { id: asignacionId },
        data: { estado: "COMPLETADA", fecha_completada: new Date() },
      }),
    ]);
    revalidatePath("/trabajador");
    revalidatePath(`/jefe/asignaciones/${asignacionId}`);
    redirect("/trabajador");
  }

  // CULTIVO: TRAMO o SUELTOS
  if (asignacion.lote_id === null) {
    return { error: "TRAMO/SUELTOS solo aplica a asignaciones de lote." };
  }
  const totalArboles = asignacion.lotes?.total_arboles ?? 0;
  if (totalArboles <= 0) {
    return { error: "El lote no tiene árboles cargados. Pídele al jefe que los cargue antes." };
  }

  let cantidad = 0;
  let arbol_desde: number | null = null;
  let arbol_hasta: number | null = null;
  let arboles_lista: number[] = [];

  if (tipoRegistro === "TRAMO") {
    const desdeRaw = String(formData.get("desde") ?? "").trim();
    const hastaRaw = String(formData.get("hasta") ?? "").trim();
    if (!/^\d+$/.test(desdeRaw) || !/^\d+$/.test(hastaRaw)) {
      return { error: "Desde y hasta deben ser enteros positivos." };
    }
    const d = parseInt(desdeRaw, 10);
    const h = parseInt(hastaRaw, 10);
    if (d < 1 || h < 1 || d > totalArboles || h > totalArboles) {
      return { error: `Los números deben estar entre 1 y ${totalArboles}.` };
    }
    if (d > h) return { error: "Desde no puede ser mayor que Hasta." };
    arbol_desde = d;
    arbol_hasta = h;
    cantidad = h - d + 1;
  } else if (tipoRegistro === "SUELTOS") {
    const listaRaw = String(formData.get("lista") ?? "").trim();
    const parsed = parsearListaNumeros(listaRaw);
    if (!parsed || parsed.length === 0) {
      return { error: "Lista de números inválida o vacía." };
    }
    const fueraDeRango = parsed.filter((n) => n > totalArboles);
    if (fueraDeRango.length > 0) {
      return { error: `Algunos números superan el total (${totalArboles}): ${fueraDeRango.slice(0, 5).join(", ")}` };
    }
    arboles_lista = parsed;
    cantidad = parsed.length;
  } else {
    return { error: "Tipo de registro inválido." };
  }

  const nuevoTotal = asignacion.arboles_completados + cantidad;
  const debeCompletar = nuevoTotal >= totalArboles;

  await prisma.$transaction([
    prisma.registros_avance.create({
      data: {
        asignacion_id: asignacionId,
        persona_id: BigInt(usuario.persona_id),
        tipo_registro: tipoRegistro === "TRAMO" ? "TRAMO" : "SUELTOS",
        arbol_desde,
        arbol_hasta,
        arboles_lista,
        cantidad_arboles: cantidad,
        observaciones,
      },
    }),
    prisma.asignaciones.update({
      where: { id: asignacionId },
      data: {
        arboles_completados: nuevoTotal,
        ultimo_arbol_trabajado: arbol_hasta !== null
          ? Math.max(asignacion.ultimo_arbol_trabajado, arbol_hasta)
          : asignacion.ultimo_arbol_trabajado,
        estado: debeCompletar ? "COMPLETADA" : "EN_CURSO",
        fecha_completada: debeCompletar ? new Date() : null,
      },
    }),
  ]);

  revalidatePath("/trabajador");
  revalidatePath(`/jefe/asignaciones/${asignacionId}`);
  redirect("/trabajador");
}
