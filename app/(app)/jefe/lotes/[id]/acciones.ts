'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import { tandasDePlacas } from '@/lib/arboles';
import { validarDatosLote, confirmacionBorradoValida } from '@/lib/lotes';

export type EstadoEdicionLote = { error: string | null; aviso: string | null };
export type EstadoSiembra = { error: string | null; aviso: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function aplicarFechaSiembraArboles(
  _prev: EstadoSiembra,
  formData: FormData
): Promise<EstadoSiembra> {
  await requerirUsuario('JEFE');

  const loteId = parsearId(String(formData.get('lote_id') ?? ''));
  if (!loteId) return { error: 'ID de lote inválido.', aviso: null };

  const modo = String(formData.get('modo') ?? '');
  if (modo !== 'lote' && modo !== 'lapso') {
    return { error: 'Modo inválido.', aviso: null };
  }

  const sobrescribir = String(formData.get('sobrescribir') ?? '') === 'on';

  if (modo === 'lote') {
    const lote = await prisma.lotes.findUnique({
      where: { id: loteId },
      select: { fecha_siembra: true },
    });
    if (!lote?.fecha_siembra) {
      return {
        error: 'Primero define una fecha de siembra para el lote.',
        aviso: null,
      };
    }
    const where = sobrescribir
      ? { lote_id: loteId, deleted_at: null }
      : { lote_id: loteId, deleted_at: null, fecha_siembra: null };
    const r = await prisma.arboles.updateMany({
      where,
      data: { fecha_siembra: lote.fecha_siembra },
    });
    revalidatePath(`/jefe/lotes/${loteId}`);
    return {
      error: null,
      aviso: `Se aplicó la fecha del lote a ${r.count} árbol${r.count === 1 ? '' : 'es'}.`,
    };
  }

  const desdeRaw = String(formData.get('desde') ?? '').trim();
  const hastaRaw = String(formData.get('hasta') ?? '').trim();
  if (!desdeRaw || !hastaRaw) {
    return { error: 'Ingresá ambas fechas (desde y hasta).', aviso: null };
  }
  const desde = new Date(desdeRaw);
  const hasta = new Date(hastaRaw);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    return { error: 'Fechas inválidas.', aviso: null };
  }
  if (desde.getTime() > hasta.getTime()) {
    return { error: 'La fecha desde no puede ser mayor que hasta.', aviso: null };
  }

  const arboles = await prisma.arboles.findMany({
    where: sobrescribir
      ? { lote_id: loteId, deleted_at: null }
      : { lote_id: loteId, deleted_at: null, fecha_siembra: null },
    select: { id: true, numero_placa: true },
    orderBy: { numero_placa: 'asc' },
  });

  if (arboles.length === 0) {
    return {
      error: null,
      aviso: 'No hay árboles para actualizar (todos ya tienen fecha o no hay árboles cargados).',
    };
  }

  const inicioMs = desde.getTime();
  const finMs = hasta.getTime();
  const n = arboles.length;

  const actualizaciones = arboles.map((a, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const ms = inicioMs + (finMs - inicioMs) * t;
    return prisma.arboles.update({
      where: { id: a.id },
      data: { fecha_siembra: new Date(ms) },
    });
  });

  try {
    await prisma.$transaction(actualizaciones);
  } catch (e) {
    return {
      error: sanitizarError(e, 'jefe/lotes/aplicar-lapso'),
      aviso: null,
    };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  return {
    error: null,
    aviso: `Se distribuyó la fecha de siembra entre ${n} árbol${
      n === 1 ? '' : 'es'
    } desde ${desdeRaw} hasta ${hastaRaw}.`,
  };
}

export async function actualizarLote(
  _prev: EstadoEdicionLote,
  formData: FormData
): Promise<EstadoEdicionLote> {
  await requerirUsuario('JEFE');

  const loteId = parsearId(String(formData.get('lote_id') ?? ''));
  if (!loteId) return { error: 'ID de lote inválido.', aviso: null };

  const fechaSiembraRaw = String(formData.get('fecha_siembra') ?? '').trim();
  const notas = String(formData.get('notas') ?? '').trim() || null;

  const validacion = validarDatosLote({
    nombre: String(formData.get('nombre') ?? ''),
    hectareas: String(formData.get('hectareas') ?? ''),
    total_arboles: String(formData.get('total_arboles') ?? '0'),
  });
  if (!validacion.ok) return { error: validacion.error, aviso: null };
  const { nombre, hectareas, total_arboles } = validacion.datos;

  let fecha_siembra: Date | null = null;
  if (fechaSiembraRaw) {
    const f = new Date(fechaSiembraRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: 'Fecha de siembra inválida.', aviso: null };
    }
    fecha_siembra = f;
  }

  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null, NOT: { id: loteId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: 'Ya hay otro lote con ese nombre.', aviso: null };
  }

  const arbolesActuales = await prisma.arboles.count({
    where: { lote_id: loteId, deleted_at: null },
  });

  let aviso: string | null = null;

  try {
    await prisma.lotes.update({
      where: { id: loteId },
      data: { nombre, hectareas, fecha_siembra, total_arboles, notas },
    });

    if (total_arboles > arbolesActuales) {
      const desde = arbolesActuales + 1;
      const hasta = total_arboles;
      // Un lote real llega a 2.300 árboles: se inserta por tandas para no
      // armar una sola sentencia gigante contra el pooler.
      for (const tanda of tandasDePlacas(desde, hasta)) {
        await prisma.arboles.createMany({
          data: tanda.map((numero_placa) => ({ lote_id: loteId, numero_placa })),
          skipDuplicates: true,
        });
      }
      aviso = `Se generaron ${hasta - arbolesActuales} árboles nuevos (placas ${desde}–${hasta}).`;
    } else if (total_arboles < arbolesActuales) {
      aviso = `Hay ${
        arbolesActuales - total_arboles
      } árboles por encima del nuevo total. No se borraron — manejarlos manualmente si es necesario.`;
    }
  } catch (e) {
    return {
      error: sanitizarError(e, 'jefe/lotes/actualizar'),
      aviso: null,
    };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath('/jefe/lotes');

  if (aviso) {
    return { error: null, aviso };
  }
  redirect(`/jefe/lotes/${loteId}`);
}

export type EstadoBorradoLote = { error: string | null };

/**
 * Soft-delete de un lote. No borra nada de verdad: marca `deleted_at`, así el
 * histórico de cosechas y asignaciones que cuelga del lote sigue existiendo.
 */
export async function borrarLote(
  _prev: EstadoBorradoLote,
  formData: FormData
): Promise<EstadoBorradoLote> {
  await requerirUsuario('JEFE');

  const loteId = parsearId(String(formData.get('lote_id') ?? ''));
  if (!loteId) return { error: 'ID de lote inválido.' };

  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { nombre: true, deleted_at: true },
  });
  if (!lote || lote.deleted_at) return { error: 'Ese lote ya no existe.' };

  const confirmacion = String(formData.get('confirmacion') ?? '');
  if (!confirmacionBorradoValida(confirmacion, lote.nombre)) {
    return { error: `Para borrarlo, escribe exactamente: ${lote.nombre}` };
  }

  // Una asignación abierta sobre un lote borrado deja al trabajador con una
  // tarea que no lleva a ninguna parte. Se cierra el paso antes de borrar.
  const abiertas = await prisma.asignaciones.count({
    where: { lote_id: loteId, estado: { in: ['PENDIENTE', 'EN_CURSO'] } },
  });
  if (abiertas > 0) {
    return {
      error: `Este lote tiene ${abiertas} ${
        abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'
      }. Ciérralas o cancélalas antes de borrarlo.`,
    };
  }

  try {
    await prisma.$transaction([
      prisma.lotes.update({ where: { id: loteId }, data: { deleted_at: new Date() } }),
      prisma.arboles.updateMany({
        where: { lote_id: loteId, deleted_at: null },
        data: { deleted_at: new Date() },
      }),
    ]);
  } catch (e) {
    return { error: sanitizarError(e, 'jefe/lotes/borrar') };
  }

  revalidatePath('/jefe/lotes');
  revalidatePath('/jefe');
  redirect('/jefe/lotes');
}
