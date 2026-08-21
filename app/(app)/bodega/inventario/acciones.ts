'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import { formatearCantidad } from '@/lib/formatos';

export type EstadoEdicion = { error: string | null };

type CategoriaItem = 'CULTIVO' | 'COSECHA' | 'APICULTURA';

function esCategoriaValida(v: string): v is CategoriaItem {
  return v === 'CULTIVO' || v === 'COSECHA' || v === 'APICULTURA';
}

function parsearEnteroOpcional(raw: string): { ok: true; valor: number | null } | { ok: false } {
  if (!raw) return { ok: true, valor: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { ok: false };
  return { ok: true, valor: n };
}

// ============= HERRAMIENTAS =============

export async function crearHerramienta(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('BODEGA');

  const nombre = String(formData.get('nombre') ?? '').trim();
  const categoriaRaw = String(formData.get('categoria') ?? '');
  const totalRaw = String(formData.get('total') ?? '').trim();

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: 'Selecciona una categoría válida.' };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: 'El total debe ser un entero mayor o igual a cero.' };
  }

  try {
    await prisma.herramientas.create({
      data: { nombre, categoria: categoriaRaw, total, activo: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Ya existe una herramienta con ese nombre.' };
    }
    return { error: sanitizarError(e, 'bodega/inventario/crear') };
  }

  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

export async function actualizarHerramienta(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('BODEGA');

  const idRaw = String(formData.get('id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'ID inválido.' };
  const id = BigInt(idRaw);

  const nombre = String(formData.get('nombre') ?? '').trim();
  const categoriaRaw = String(formData.get('categoria') ?? '');
  const totalRaw = String(formData.get('total') ?? '').trim();

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: 'Categoría inválida.' };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: 'El total debe ser un entero ≥ 0.' };
  }

  try {
    await prisma.herramientas.update({
      where: { id },
      data: { nombre, categoria: categoriaRaw, total },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Ya existe una herramienta con ese nombre.' };
    }
    return { error: sanitizarError(e, 'bodega/inventario/actualizar') };
  }

  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

/**
 * Da de baja una herramienta, o la vuelve a activar.
 *
 * No se borra de verdad: los despachos ya hechos la referencian y borrarla
 * dejaría huecos en el historial. Dada de baja desaparece de las listas donde
 * se elige qué despachar, que es lo que se busca al querer "eliminarla".
 */
export async function cambiarEstadoHerramienta(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requerirUsuario('BODEGA');

  const idRaw = String(formData.get('id') ?? '');
  const activar = formData.get('activar') === 'true';
  if (!/^\d+$/.test(idRaw)) return { error: 'Herramienta no encontrada.' };
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        herramienta_id: id,
        despachos: { estado: 'ABIERTO' },
      },
      select: { id: true },
    });
    if (enUso) {
      // Antes se devolvía sin decir nada y el botón parecía no funcionar.
      return {
        error: 'No se puede dar de baja: está en un despacho abierto. Cerralo primero.',
      };
    }
  }

  await prisma.herramientas.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

// ============= INSUMOS =============

export async function crearInsumo(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('BODEGA');

  const nombre = String(formData.get('nombre') ?? '').trim();
  const categoriaRaw = String(formData.get('categoria') ?? '');
  const unidad = String(formData.get('unidad') ?? '').trim();
  const stockMinRaw = String(formData.get('stock_minimo') ?? '').trim();
  const costoRaw = String(formData.get('costo_unitario') ?? '').trim();

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: 'Categoría inválida.' };
  }
  if (!unidad) return { error: 'La unidad es obligatoria (ej: L, kg, unidades).' };

  const stockMin = Number(stockMinRaw || '0');
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: 'Stock mínimo debe ser ≥ 0.' };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: 'Costo unitario debe ser un número positivo.' };
    }
    costo = c;
  }

  const ingredienteActivo = String(formData.get('ingrediente_activo') ?? '').trim() || null;
  const registroIca = String(formData.get('registro_ica') ?? '').trim() || null;
  const carenciaParse = parsearEnteroOpcional(
    String(formData.get('periodo_carencia_dias') ?? '').trim()
  );
  if (!carenciaParse.ok) return { error: 'Carencia debe ser un entero ≥ 0 (días).' };
  if (carenciaParse.valor !== null && carenciaParse.valor > 90) {
    return { error: 'Carencia máxima soportada: 90 días.' };
  }
  const reingresoParse = parsearEnteroOpcional(
    String(formData.get('periodo_reingreso_horas') ?? '').trim()
  );
  if (!reingresoParse.ok) return { error: 'Reingreso debe ser un entero ≥ 0 (horas).' };

  try {
    await prisma.insumos.create({
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
        activo: true,
        ingrediente_activo: ingredienteActivo,
        registro_ica: registroIca,
        periodo_carencia_dias: carenciaParse.valor,
        periodo_reingreso_horas: reingresoParse.valor,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Ya existe un insumo con ese nombre.' };
    }
    return { error: sanitizarError(e, 'bodega/inventario/crear') };
  }

  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

export async function actualizarInsumo(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  await requerirUsuario('BODEGA');

  const idRaw = String(formData.get('id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'ID inválido.' };
  const id = BigInt(idRaw);

  const nombre = String(formData.get('nombre') ?? '').trim();
  const categoriaRaw = String(formData.get('categoria') ?? '');
  const unidad = String(formData.get('unidad') ?? '').trim();
  const stockMinRaw = String(formData.get('stock_minimo') ?? '').trim();
  const costoRaw = String(formData.get('costo_unitario') ?? '').trim();

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (!esCategoriaValida(categoriaRaw)) return { error: 'Categoría inválida.' };
  if (!unidad) return { error: 'Unidad obligatoria.' };

  const stockMin = Number(stockMinRaw || '0');
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: 'Stock mínimo ≥ 0.' };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: 'Costo unitario debe ser positivo.' };
    }
    costo = c;
  }

  const ingredienteActivo = String(formData.get('ingrediente_activo') ?? '').trim() || null;
  const registroIca = String(formData.get('registro_ica') ?? '').trim() || null;
  const carenciaParse = parsearEnteroOpcional(
    String(formData.get('periodo_carencia_dias') ?? '').trim()
  );
  if (!carenciaParse.ok) return { error: 'Carencia debe ser un entero ≥ 0 (días).' };
  if (carenciaParse.valor !== null && carenciaParse.valor > 90) {
    return { error: 'Carencia máxima soportada: 90 días.' };
  }
  const reingresoParse = parsearEnteroOpcional(
    String(formData.get('periodo_reingreso_horas') ?? '').trim()
  );
  if (!reingresoParse.ok) return { error: 'Reingreso debe ser un entero ≥ 0 (horas).' };

  try {
    await prisma.insumos.update({
      where: { id },
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
        ingrediente_activo: ingredienteActivo,
        registro_ica: registroIca,
        periodo_carencia_dias: carenciaParse.valor,
        periodo_reingreso_horas: reingresoParse.valor,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Ya existe un insumo con ese nombre.' };
    }
    return { error: sanitizarError(e, 'bodega/inventario/actualizar') };
  }

  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

/** Mismo criterio que en herramientas: se da de baja, no se borra. */
export async function cambiarEstadoInsumo(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requerirUsuario('BODEGA');

  const idRaw = String(formData.get('id') ?? '');
  const activar = formData.get('activar') === 'true';
  if (!/^\d+$/.test(idRaw)) return { error: 'Insumo no encontrado.' };
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        insumo_id: id,
        despachos: { estado: 'ABIERTO' },
      },
      select: { id: true },
    });
    if (enUso) {
      return {
        error: 'No se puede dar de baja: está en un despacho abierto. Cerralo primero.',
      };
    }
  }

  await prisma.insumos.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

// ============= INGRESO DE STOCK =============

export async function ingresarStock(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  // El jefe también: llega acá desde su alerta de stock bajo, y de nada sirve
  // dejarlo ver el formulario si al enviarlo lo devuelve al mapa. El resto de
  // las acciones de bodega siguen siendo sólo del bodeguero.
  const usuario = await requerirUsuario(['BODEGA', 'JEFE']);

  const idRaw = String(formData.get('insumo_id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'Insumo inválido.' };
  const insumoId = BigInt(idRaw);

  const cantidadRaw = String(formData.get('cantidad') ?? '').trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: 'Cantidad debe ser un número positivo.' };
  }

  const notas = String(formData.get('notas') ?? '').trim() || null;

  try {
    await prisma.$transaction([
      prisma.insumos.update({
        where: { id: insumoId },
        data: { stock_actual: { increment: cantidad } },
      }),
      prisma.movimientos_insumo.create({
        data: {
          insumo_id: insumoId,
          tipo: 'INGRESO',
          cantidad: cantidad,
          usuario_id: usuario.id,
          notas,
        },
      }),
    ]);
  } catch (e) {
    return { error: sanitizarError(e, 'bodega/inventario/ingresar') };
  }

  revalidatePath('/bodega/inventario');
  redirect('/bodega/inventario');
}

export async function ajustarStock(
  _prev: EstadoEdicion,
  formData: FormData
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario('BODEGA');

  const idRaw = String(formData.get('insumo_id') ?? '');
  if (!/^\d+$/.test(idRaw)) return { error: 'Insumo inválido.' };
  const insumoId = BigInt(idRaw);

  const cantidadRaw = String(formData.get('cantidad') ?? '').trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad === 0) {
    return { error: 'Cantidad debe ser distinta de cero (negativa para restar).' };
  }

  const motivo = String(formData.get('motivo') ?? '').trim();
  if (!motivo) {
    return { error: 'Motivo obligatorio (ej: rotura, pérdida, conteo).' };
  }

  if (cantidad < 0) {
    const insumo = await prisma.insumos.findUnique({
      where: { id: insumoId },
      select: { stock_actual: true, nombre: true, unidad: true },
    });
    if (!insumo) return { error: 'Insumo no encontrado.' };
    const stockResultante = Number(insumo.stock_actual) + cantidad;
    if (stockResultante < 0) {
      return {
        error: `Stock quedaría negativo (${formatearCantidad(stockResultante)} ${insumo.unidad}).`,
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
          tipo: 'AJUSTE',
          cantidad,
          usuario_id: usuario.id,
          notas: motivo,
        },
      }),
    ]);
  } catch (e) {
    return { error: sanitizarError(e, 'bodega/inventario/ajustar') };
  }

  revalidatePath('/bodega/inventario');
  revalidatePath(`/bodega/inventario/insumos/${idRaw}/historial`);
  redirect(`/bodega/inventario/insumos/${idRaw}/historial`);
}
