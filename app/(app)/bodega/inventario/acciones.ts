"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

type CategoriaItem = "CULTIVO" | "COSECHA" | "APICULTURA";

function esCategoriaValida(v: string): v is CategoriaItem {
  return v === "CULTIVO" || v === "COSECHA" || v === "APICULTURA";
}

// ============= HERRAMIENTAS =============

export async function crearHerramienta(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const totalRaw = String(formData.get("total") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Selecciona una categoría válida." };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: "El total debe ser un entero mayor o igual a cero." };
  }

  try {
    await prisma.herramientas.create({
      data: { nombre, categoria: categoriaRaw, total, activo: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe una herramienta con ese nombre." };
    }
    return { error: `No se pudo crear: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function actualizarHerramienta(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "ID inválido." };
  const id = BigInt(idRaw);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const totalRaw = String(formData.get("total") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Categoría inválida." };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: "El total debe ser un entero ≥ 0." };
  }

  try {
    await prisma.herramientas.update({
      where: { id },
      data: { nombre, categoria: categoriaRaw, total },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe una herramienta con ese nombre." };
    }
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function cambiarEstadoHerramienta(formData: FormData) {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";
  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        herramienta_id: id,
        despachos: { estado: "ABIERTO" },
      },
      select: { id: true },
    });
    if (enUso) {
      // Silenciosamente no la desactivamos. La UI ya muestra el estado.
      return;
    }
  }

  await prisma.herramientas.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath("/bodega/inventario");
}

// ============= INSUMOS =============

export async function crearInsumo(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const unidad = String(formData.get("unidad") ?? "").trim();
  const stockMinRaw = String(formData.get("stock_minimo") ?? "").trim();
  const costoRaw = String(formData.get("costo_unitario") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Categoría inválida." };
  }
  if (!unidad) return { error: "La unidad es obligatoria (ej: L, kg, unidades)." };

  const stockMin = Number(stockMinRaw || "0");
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: "Stock mínimo debe ser ≥ 0." };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Costo unitario debe ser un número positivo." };
    }
    costo = c;
  }

  try {
    await prisma.insumos.create({
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
        activo: true,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe un insumo con ese nombre." };
    }
    return { error: `No se pudo crear: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function actualizarInsumo(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "ID inválido." };
  const id = BigInt(idRaw);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const unidad = String(formData.get("unidad") ?? "").trim();
  const stockMinRaw = String(formData.get("stock_minimo") ?? "").trim();
  const costoRaw = String(formData.get("costo_unitario") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) return { error: "Categoría inválida." };
  if (!unidad) return { error: "Unidad obligatoria." };

  const stockMin = Number(stockMinRaw || "0");
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: "Stock mínimo ≥ 0." };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Costo unitario debe ser positivo." };
    }
    costo = c;
  }

  try {
    await prisma.insumos.update({
      where: { id },
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe un insumo con ese nombre." };
    }
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function cambiarEstadoInsumo(formData: FormData) {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";
  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        insumo_id: id,
        despachos: { estado: "ABIERTO" },
      },
      select: { id: true },
    });
    if (enUso) return;
  }

  await prisma.insumos.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath("/bodega/inventario");
}

// ============= INGRESO DE STOCK =============

export async function ingresarStock(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("insumo_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Insumo inválido." };
  const insumoId = BigInt(idRaw);

  const cantidadRaw = String(formData.get("cantidad") ?? "").trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Cantidad debe ser un número positivo." };
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  try {
    await prisma.$transaction([
      prisma.insumos.update({
        where: { id: insumoId },
        data: { stock_actual: { increment: cantidad } },
      }),
      prisma.movimientos_insumo.create({
        data: {
          insumo_id: insumoId,
          tipo: "INGRESO",
          cantidad: cantidad,
          usuario_id: usuario.id,
          notas,
        },
      }),
    ]);
  } catch (e) {
    return { error: `Error al ingresar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function ajustarStock(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("insumo_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Insumo inválido." };
  const insumoId = BigInt(idRaw);

  const cantidadRaw = String(formData.get("cantidad") ?? "").trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad === 0) {
    return { error: "Cantidad debe ser distinta de cero (negativa para restar)." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!motivo) {
    return { error: "Motivo obligatorio (ej: rotura, pérdida, conteo)." };
  }

  if (cantidad < 0) {
    const insumo = await prisma.insumos.findUnique({
      where: { id: insumoId },
      select: { stock_actual: true, nombre: true, unidad: true },
    });
    if (!insumo) return { error: "Insumo no encontrado." };
    const stockResultante = Number(insumo.stock_actual) + cantidad;
    if (stockResultante < 0) {
      return {
        error: `Stock quedaría negativo (${stockResultante.toFixed(3)} ${insumo.unidad}).`,
      };
    }
  }

  try {
    await prisma.$transaction([
      prisma.insumos.update({
        where: { id: insumoId },
        data: { stock_actual: { increment: cantidad } },
      }),
      prisma.movimientos_insumo.create({
        data: {
          insumo_id: insumoId,
          tipo: "AJUSTE",
          cantidad,
          usuario_id: usuario.id,
          notas: motivo,
        },
      }),
    ]);
  } catch (e) {
    return { error: `Error al ajustar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  revalidatePath(`/bodega/inventario/insumos/${idRaw}/historial`);
  redirect(`/bodega/inventario/insumos/${idRaw}/historial`);
}
