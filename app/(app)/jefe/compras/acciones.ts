'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';

export type EstadoCompra = { error: string | null };

/** Cada item es un insumo O una herramienta (CHECK chk_compras_items_un_objeto). */
type ItemEntrada = {
  insumo_id?: string;
  herramienta_id?: string;
  cantidad: number;
  costo_unitario: number;
  notas?: string;
};

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearCompra(_prev: EstadoCompra, formData: FormData): Promise<EstadoCompra> {
  const usuario = await requerirUsuario('JEFE');

  const proveedorIdRaw = String(formData.get('proveedor_id') ?? '').trim();
  const proveedorNuevoNombre = String(formData.get('proveedor_nuevo_nombre') ?? '').trim();
  const fechaRaw = String(formData.get('fecha') ?? '').trim();
  const numeroFactura = String(formData.get('numero_factura') ?? '').trim();
  const notas = String(formData.get('notas') ?? '').trim();
  const itemsRaw = String(formData.get('items') ?? '').trim();

  let proveedorId = proveedorIdRaw ? parsearId(proveedorIdRaw) : null;
  if (!proveedorId && !proveedorNuevoNombre) {
    return { error: 'Elige un proveedor o escribe el nombre.' };
  }

  if (!fechaRaw) return { error: 'Elige la fecha de la compra.' };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'Fecha inválida.' };
  }

  let items: ItemEntrada[] = [];
  try {
    items = JSON.parse(itemsRaw) as ItemEntrada[];
  } catch {
    return { error: 'Items inválidos.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Agrega al menos un item a la compra.' };
  }

  // Validar cada item
  for (const [i, it] of items.entries()) {
    const esInsumo = parsearId(it.insumo_id ?? null) !== null;
    const esHerramienta = parsearId(it.herramienta_id ?? null) !== null;
    if (esInsumo === esHerramienta) {
      return { error: `Item ${i + 1}: elige un insumo o una herramienta.` };
    }
    if (!Number.isFinite(it.cantidad) || it.cantidad <= 0) {
      return { error: `Item ${i + 1}: cantidad inválida.` };
    }
    if (esHerramienta && !Number.isInteger(it.cantidad)) {
      return { error: `Item ${i + 1}: las herramientas se compran por unidad.` };
    }
    if (!Number.isFinite(it.costo_unitario) || it.costo_unitario < 0) {
      return { error: `Item ${i + 1}: costo unitario inválido.` };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Crear proveedor sobre la marcha si fue nuevo
      if (!proveedorId && proveedorNuevoNombre) {
        const nuevo = await tx.proveedores.create({
          data: {
            nombre: proveedorNuevoNombre,
            registrado_por_usuario_id: usuario.id,
          },
        });
        proveedorId = nuevo.id;
      }

      const compra = await tx.compras.create({
        data: {
          proveedor_id: proveedorId,
          fecha,
          numero_factura: numeroFactura || null,
          notas: notas || null,
          registrado_por_usuario_id: usuario.id,
          // total se calcula via trigger al insertar items
          total: 0,
        },
      });

      // Crear items: los triggers actualizan stock + total
      for (const it of items) {
        await tx.compras_items.create({
          data: {
            compra_id: compra.id,
            insumo_id: parsearId(it.insumo_id ?? null),
            herramienta_id: parsearId(it.herramienta_id ?? null),
            cantidad: it.cantidad,
            costo_unitario: it.costo_unitario,
            notas: it.notas?.trim() || null,
          },
        });
      }
    });
  } catch (e) {
    return { error: sanitizarError(e, 'compras/crear') };
  }

  revalidatePath('/jefe/compras');
  revalidatePath('/jefe/inventario');
  revalidatePath('/jefe/saldos');
  redirect('/jefe/compras');
}

export async function editarCompra(_prev: EstadoCompra, formData: FormData): Promise<EstadoCompra> {
  const usuario = await requerirUsuario('JEFE');

  const idRaw = String(formData.get('id') ?? '').trim();
  const id = parsearId(idRaw);
  if (!id) return { error: 'ID de compra inválido.' };

  const proveedorIdRaw = String(formData.get('proveedor_id') ?? '').trim();
  const proveedorNuevoNombre = String(formData.get('proveedor_nuevo_nombre') ?? '').trim();
  const fechaRaw = String(formData.get('fecha') ?? '').trim();
  const numeroFactura = String(formData.get('numero_factura') ?? '').trim();
  const notas = String(formData.get('notas') ?? '').trim();

  let proveedorId = proveedorIdRaw ? parsearId(proveedorIdRaw) : null;
  if (!proveedorId && !proveedorNuevoNombre) {
    return { error: 'Elige un proveedor o escribe el nombre.' };
  }

  if (!fechaRaw) return { error: 'Elige la fecha de la compra.' };
  const fecha = new Date(`${fechaRaw}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'Fecha inválida.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Crear proveedor sobre la marcha si fue nuevo
      if (!proveedorId && proveedorNuevoNombre) {
        const nuevo = await tx.proveedores.create({
          data: {
            nombre: proveedorNuevoNombre,
            registrado_por_usuario_id: usuario.id,
          },
        });
        proveedorId = nuevo.id;
      }

      await tx.compras.update({
        where: { id, borrado_en: null },
        data: {
          proveedor_id: proveedorId,
          fecha,
          numero_factura: numeroFactura || null,
          notas: notas || null,
        },
      });
    });
  } catch (e) {
    return { error: sanitizarError(e, 'compras/editar') };
  }

  revalidatePath('/jefe/compras');
  revalidatePath(`/jefe/compras/${id}`);
  redirect(`/jefe/compras/${id}`);
}

export async function borrarCompra(formData: FormData) {
  const usuario = await requerirUsuario('JEFE');
  const id = parsearId(String(formData.get('id') ?? ''));
  if (!id) return;
  try {
    await prisma.$transaction(async (tx) => {
      const compra = await tx.compras.findUnique({
        where: { id: id },
        include: { items: true },
      });
      if (!compra || compra.borrado_en !== null) return;

      // Revertir stock por cada item antes de soft-delete
      for (const item of compra.items) {
        if (item.herramienta_id !== null) {
          const h = await tx.herramientas.findUnique({
            where: { id: item.herramienta_id },
            select: { total: true },
          });
          await tx.herramientas.update({
            where: { id: item.herramienta_id },
            data: { total: Math.max(0, (h?.total ?? 0) - Number(item.cantidad)) },
          });
          continue;
        }
        if (item.insumo_id === null) continue;
        await tx.insumos.update({
          where: { id: item.insumo_id },
          data: {
            stock_actual: { decrement: Number(item.cantidad) },
          },
        });
        await tx.movimientos_insumo.create({
          data: {
            insumo_id: item.insumo_id,
            tipo: 'AJUSTE',
            cantidad: -Number(item.cantidad),
            notas: `Reversión por anulación de compra #${compra.id}`,
            usuario_id: usuario.id,
          },
        });
      }

      await tx.compras.update({
        where: { id },
        data: {
          borrado_en: new Date(),
          borrado_por: usuario.id,
        },
      });
    });
  } catch {
    // best-effort
  }
  revalidatePath('/jefe/compras');
  revalidatePath('/jefe/inventario');
  revalidatePath('/jefe/saldos');
}
