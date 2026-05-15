"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

type TipoSalida = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

function esTipoValido(v: string): v is TipoSalida {
  return v === "VENTA" || v === "CONSUMO" || v === "PERDIDA" || v === "OTRO";
}

export async function crearSalida(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("ALMACEN");

  const tipoRaw = String(formData.get("tipo") ?? "");
  if (!esTipoValido(tipoRaw)) return { error: "Tipo inválido." };
  const tipo = tipoRaw;

  const cantidadRaw = String(formData.get("cantidad_kg") ?? "").trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Cantidad debe ser positiva." };
  }

  const cliente = String(formData.get("cliente_detalle") ?? "").trim();
  if (tipo === "VENTA" && !cliente) {
    return { error: "Para ventas, indica el cliente." };
  }
  const clienteDetalle = cliente || null;

  const precioRaw = String(formData.get("precio_total") ?? "").trim();
  let precio: number | null = null;
  if (tipo === "VENTA" && precioRaw) {
    const p = Number(precioRaw);
    if (!Number.isFinite(p) || p <= 0) {
      return { error: "Precio total debe ser positivo." };
    }
    precio = p;
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  // Verificar stock
  const stockRows = await prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `;
  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  if (cantidad > stock) {
    return {
      error: `Stock insuficiente. Disponible: ${stock.toFixed(2)} kg`,
    };
  }

  try {
    await prisma.salidas_cosecha.create({
      data: {
        tipo,
        cantidad_kg: cantidad,
        cliente_detalle: clienteDetalle,
        precio_total: precio,
        registrado_por_usuario_id: usuario.id,
        notas,
      },
    });
  } catch (e) {
    return { error: `No se pudo registrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/almacen");
  revalidatePath("/almacen/salidas");
  redirect("/almacen/salidas");
}
