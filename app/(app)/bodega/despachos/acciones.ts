"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

type ItemInput = {
  tipo: "HERRAMIENTA" | "INSUMO";
  ref_id: string;
  cantidad: string;
};

export async function crearDespacho(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const personaIdRaw = String(formData.get("persona_id") ?? "");
  if (!/^\d+$/.test(personaIdRaw)) return { error: "Persona inválida." };
  const personaId = BigInt(personaIdRaw);

  const asignacionIdRaw = String(formData.get("asignacion_id") ?? "").trim();
  let asignacionId: bigint | null = null;
  if (asignacionIdRaw && /^\d+$/.test(asignacionIdRaw)) {
    asignacionId = BigInt(asignacionIdRaw);
  }

  const itemsRaw = String(formData.get("items") ?? "[]");
  let items: ItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Formato de items inválido." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Agrega al menos un item al despacho." };
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  // Validar items
  for (const it of items) {
    if (it.tipo !== "HERRAMIENTA" && it.tipo !== "INSUMO") {
      return { error: "Tipo de item inválido." };
    }
    if (!/^\d+$/.test(it.ref_id)) {
      return { error: "Referencia de item inválida." };
    }
    const c = Number(it.cantidad);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Cantidad inválida en uno de los items." };
    }
  }

  // Verificar stock de insumos (sumando duplicados del mismo insumo)
  const insumosNecesarios = new Map<string, number>();
  for (const it of items) {
    if (it.tipo === "INSUMO") {
      insumosNecesarios.set(
        it.ref_id,
        (insumosNecesarios.get(it.ref_id) ?? 0) + Number(it.cantidad),
      );
    }
  }

  for (const [refId, cantidad] of insumosNecesarios) {
    const stock = await prisma.$queryRaw<
      { stock_disponible: string; nombre: string; unidad: string }[]
    >`
      SELECT stock_disponible::text, nombre, unidad
      FROM v_insumos_stock
      WHERE id = ${BigInt(refId)}
    `;
    if (stock.length === 0) {
      return { error: "Insumo inexistente." };
    }
    const disponible = Number(stock[0].stock_disponible);
    if (disponible < cantidad) {
      return {
        error: `Stock insuficiente de ${stock[0].nombre} (disponible: ${disponible} ${stock[0].unidad}, pedido: ${cantidad})`,
      };
    }
  }

  // Transacción
  try {
    await prisma.$transaction(async (tx) => {
      const despacho = await tx.despachos.create({
        data: {
          persona_id: personaId,
          asignacion_id: asignacionId,
          despachado_por_usuario_id: usuario.id,
          estado: "ABIERTO",
          notas,
        },
      });

      for (const it of items) {
        const cantidad = Number(it.cantidad);
        const itemCreado = await tx.despacho_items.create({
          data: {
            despacho_id: despacho.id,
            tipo_item: it.tipo,
            herramienta_id:
              it.tipo === "HERRAMIENTA" ? BigInt(it.ref_id) : null,
            insumo_id: it.tipo === "INSUMO" ? BigInt(it.ref_id) : null,
            cantidad,
          },
        });

        if (it.tipo === "INSUMO") {
          await tx.insumos.update({
            where: { id: BigInt(it.ref_id) },
            data: { stock_reservado: { increment: cantidad } },
          });
          await tx.movimientos_insumo.create({
            data: {
              insumo_id: BigInt(it.ref_id),
              tipo: "RESERVA",
              cantidad: -cantidad,
              despacho_item_id: itemCreado.id,
              usuario_id: usuario.id,
            },
          });
        }
      }
    });
  } catch (e) {
    return {
      error: `No se pudo crear el despacho: ${(e as Error)?.message ?? "desconocido"}`,
    };
  }

  revalidatePath("/bodega/despachos");
  redirect("/bodega/despachos");
}

export async function cerrarDespacho(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const despachoIdRaw = String(formData.get("despacho_id") ?? "");
  if (!/^\d+$/.test(despachoIdRaw)) return { error: "Despacho inválido." };
  const despachoId = BigInt(despachoIdRaw);

  const despacho = await prisma.despachos.findUnique({
    where: { id: despachoId },
    include: { despacho_items: true },
  });
  if (!despacho) return { error: "Despacho no encontrado." };
  if (despacho.estado !== "ABIERTO") {
    return { error: "Este despacho ya está cerrado." };
  }

  type Actualizacion = {
    itemId: bigint;
    tipo: "HERRAMIENTA" | "INSUMO";
    insumoId: bigint | null;
    cantidadOriginal: number;
    devuelto?: boolean;
    consumido?: number;
  };
  const actualizaciones: Actualizacion[] = [];

  for (const item of despacho.despacho_items) {
    if (item.tipo_item === "HERRAMIENTA") {
      const dev = formData.get(`devuelto_${item.id.toString()}`);
      actualizaciones.push({
        itemId: item.id,
        tipo: "HERRAMIENTA",
        insumoId: null,
        cantidadOriginal: Number(item.cantidad),
        devuelto: dev === "on",
      });
    } else {
      const raw = String(
        formData.get(`consumido_${item.id.toString()}`) ?? "",
      ).trim();
      const consumido = Number(raw);
      const cantidadOriginal = Number(item.cantidad);
      if (!Number.isFinite(consumido) || consumido < 0) {
        return { error: `Cantidad consumida inválida en un item.` };
      }
      if (consumido > cantidadOriginal) {
        return {
          error: `La cantidad consumida no puede ser mayor a la despachada.`,
        };
      }
      actualizaciones.push({
        itemId: item.id,
        tipo: "INSUMO",
        insumoId: item.insumo_id,
        cantidadOriginal,
        consumido,
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const a of actualizaciones) {
        if (a.tipo === "HERRAMIENTA") {
          await tx.despacho_items.update({
            where: { id: a.itemId },
            data: { devuelto: a.devuelto ?? false },
          });
        } else {
          if (a.insumoId === null) continue;
          await tx.despacho_items.update({
            where: { id: a.itemId },
            data: { cantidad_consumida: a.consumido! },
          });
          await tx.insumos.update({
            where: { id: a.insumoId },
            data: {
              stock_actual: { decrement: a.consumido! },
              stock_reservado: { decrement: a.cantidadOriginal },
            },
          });
          if (a.consumido! > 0) {
            await tx.movimientos_insumo.create({
              data: {
                insumo_id: a.insumoId,
                tipo: "CONSUMO",
                cantidad: -a.consumido!,
                despacho_item_id: a.itemId,
                usuario_id: usuario.id,
              },
            });
          }
          const devuelto = a.cantidadOriginal - a.consumido!;
          if (devuelto > 0) {
            await tx.movimientos_insumo.create({
              data: {
                insumo_id: a.insumoId,
                tipo: "DEVOLUCION",
                cantidad: devuelto,
                despacho_item_id: a.itemId,
                usuario_id: usuario.id,
              },
            });
          }
        }
      }

      await tx.despachos.update({
        where: { id: despachoId },
        data: { estado: "CERRADO", fecha_devolucion: new Date() },
      });
    });
  } catch (e) {
    return { error: `Error al cerrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/despachos");
  redirect("/bodega/despachos");
}
