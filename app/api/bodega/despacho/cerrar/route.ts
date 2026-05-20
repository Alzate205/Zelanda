import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  notificarStockBajoSiCorresponde,
  snapshotDisponiblesAntes,
} from "@/lib/push/stock-bajo";

type ItemBody = {
  despacho_item_id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  devuelto?: boolean;
  consumido?: number;
};

type Body = {
  id_local: string;
  despacho_id: string;
  items: ItemBody[];
};

function esUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!esUuid(body.id_local)) {
    return NextResponse.json({ error: "id_local inválido" }, { status: 400 });
  }
  if (!/^\d+$/.test(String(body.despacho_id ?? ""))) {
    return NextResponse.json(
      { error: "despacho_id inválido" },
      { status: 400 },
    );
  }
  const despachoId = BigInt(body.despacho_id);

  // Idempotencia: si el despacho ya está CERRADO, asumir que es la misma operación.
  const despacho = await prisma.despachos.findUnique({
    where: { id: despachoId },
    include: { despacho_items: true },
  });
  if (!despacho) {
    return NextResponse.json(
      { error: "Despacho no encontrado." },
      { status: 404 },
    );
  }
  if (despacho.estado === "CERRADO") {
    return NextResponse.json({
      ok: true,
      id: String(despachoId),
      duplicado: true,
    });
  }

  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "BODEGA") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "Items inválidos." }, { status: 400 });
  }

  // Indexar items recibidos por despacho_item_id.
  const mapaItemsBody = new Map<string, ItemBody>();
  for (const it of body.items) {
    if (!/^\d+$/.test(String(it.despacho_item_id ?? ""))) {
      return NextResponse.json(
        { error: "despacho_item_id inválido." },
        { status: 400 },
      );
    }
    mapaItemsBody.set(String(it.despacho_item_id), it);
  }

  // Verificar que el body cubre exactamente los items del despacho.
  if (mapaItemsBody.size !== despacho.despacho_items.length) {
    return NextResponse.json(
      { error: "Los items del cierre no coinciden con el despacho." },
      { status: 409 },
    );
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
    const recibido = mapaItemsBody.get(String(item.id));
    if (!recibido) {
      return NextResponse.json(
        { error: `Falta el item ${item.id.toString()} en el cierre.` },
        { status: 409 },
      );
    }
    if (recibido.tipo !== item.tipo_item) {
      return NextResponse.json(
        { error: "Tipo de item no coincide con el despacho." },
        { status: 409 },
      );
    }

    if (item.tipo_item === "HERRAMIENTA") {
      actualizaciones.push({
        itemId: item.id,
        tipo: "HERRAMIENTA",
        insumoId: null,
        cantidadOriginal: Number(item.cantidad),
        devuelto: recibido.devuelto === true,
      });
    } else {
      const consumido = Number(recibido.consumido ?? 0);
      const cantidadOriginal = Number(item.cantidad);
      if (!Number.isFinite(consumido) || consumido < 0) {
        return NextResponse.json(
          { error: "Cantidad consumida inválida en un item." },
          { status: 400 },
        );
      }
      if (consumido > cantidadOriginal) {
        return NextResponse.json(
          {
            error:
              "La cantidad consumida no puede ser mayor a la despachada.",
          },
          { status: 400 },
        );
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

  const insumoIdsPush: bigint[] = despacho.despacho_items
    .filter((it) => it.tipo_item === "INSUMO" && it.insumo_id !== null)
    .map((it) => it.insumo_id as bigint);
  const disponiblesAntes = await snapshotDisponiblesAntes(insumoIdsPush);

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
    return NextResponse.json(
      { error: `Error al cerrar: ${(e as Error)?.message ?? "desconocido"}` },
      { status: 500 },
    );
  }

  try {
    await notificarStockBajoSiCorresponde(insumoIdsPush, disponiblesAntes);
  } catch (e) {
    console.warn("Push stock bajo falló:", e);
  }

  return NextResponse.json({ ok: true, id: String(despachoId) });
}
