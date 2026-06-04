'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';

export type EstadoAsignacion = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function crearAsignacion(
  _prev: EstadoAsignacion,
  formData: FormData
): Promise<EstadoAsignacion> {
  const usuario = await requerirUsuario('JEFE');

  const destino = String(formData.get('destino') ?? '');
  const loteIdRaw = formData.get('lote_id') ? String(formData.get('lote_id')) : null;
  const apiarioIdRaw = formData.get('apiario_id') ? String(formData.get('apiario_id')) : null;
  const tipoTareaId = parsearId(String(formData.get('tipo_tarea_id') ?? ''));
  const personaId = parsearId(String(formData.get('persona_id') ?? ''));
  const fechaInicioRaw = String(formData.get('fecha_inicio') ?? '').trim();

  if (destino !== 'lote' && destino !== 'apiario') {
    return { error: 'Selecciona un destino (lote o apiario).' };
  }
  if (!tipoTareaId) return { error: 'Selecciona un tipo de tarea.' };
  if (!personaId) return { error: 'Selecciona una persona.' };

  const loteId = destino === 'lote' ? parsearId(loteIdRaw) : null;
  const apiarioId = destino === 'apiario' ? parsearId(apiarioIdRaw) : null;

  if (destino === 'lote' && !loteId) return { error: 'Selecciona un lote válido.' };
  if (destino === 'apiario' && !apiarioId) return { error: 'Selecciona un apiario válido.' };

  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: tipoTareaId },
    select: { area: true, activo: true },
  });
  if (!tipo || !tipo.activo) return { error: 'Tipo de tarea no válido o inactivo.' };

  if (destino === 'lote' && tipo.area !== 'CULTIVO') {
    return { error: 'Tipos de apicultura solo se asignan a apiarios.' };
  }
  if (destino === 'apiario' && tipo.area !== 'APICULTURA') {
    return { error: 'Tipos de cultivo solo se asignan a lotes.' };
  }

  let fecha_inicio: Date | null = null;
  if (fechaInicioRaw) {
    const f = new Date(fechaInicioRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: 'Fecha de inicio inválida.' };
    }
    const limite = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (f > limite) {
      return { error: 'La fecha de inicio no puede ser de más de un año en el futuro.' };
    }
    fecha_inicio = f;
  }

  let nuevaId: bigint;
  try {
    const creada = await prisma.asignaciones.create({
      data: {
        persona_id: personaId,
        lote_id: loteId,
        apiario_id: apiarioId,
        tipo_tarea_id: tipoTareaId,
        fecha_inicio: fecha_inicio ?? new Date(),
        estado: 'PENDIENTE',
        creado_por_usuario_id: usuario.id,
      },
    });
    nuevaId = creada.id;
  } catch (e) {
    return { error: sanitizarError(e, 'jefe/asignaciones/crear') };
  }

  try {
    const destinatario = await prisma.usuarios.findFirst({
      where: { persona_id: personaId, activo: true },
      select: { id: true },
    });
    if (destinatario) {
      const [tipoTarea, lote, apiario] = await Promise.all([
        prisma.tipos_tarea.findUnique({
          where: { id: tipoTareaId },
          select: { nombre: true },
        }),
        loteId
          ? prisma.lotes.findUnique({
              where: { id: loteId },
              select: { nombre: true },
            })
          : Promise.resolve(null),
        apiarioId
          ? prisma.apiarios.findUnique({
              where: { id: apiarioId },
              select: { nombre: true },
            })
          : Promise.resolve(null),
      ]);
      const ubicacion = lote?.nombre ?? apiario?.nombre ?? '—';
      const { enviarPushAUsuarios } = await import('@/lib/push/enviar');
      await enviarPushAUsuarios([destinatario.id], {
        titulo: 'Nueva tarea asignada',
        cuerpo: `${tipoTarea?.nombre ?? 'Tarea'} · ${ubicacion}`,
        url: `/trabajador/avance/${nuevaId}`,
        tag: `asignacion-${nuevaId}`,
      });
    }
  } catch (e) {
    console.warn('Push asignación falló:', e);
  }

  revalidatePath('/jefe/asignaciones');
  revalidatePath('/trabajador');
  redirect('/jefe/asignaciones');
}

type DestinoMasivo = { kind: 'lote' | 'apiario'; id: string };

export type ResultadoMasivo = {
  error: string | null;
  creadas: number;
  duplicadas: number;
};

export async function crearAsignacionesMasivas(input: {
  tipo_tarea_id: string;
  persona_id: string;
  destinos: DestinoMasivo[];
  fecha_inicio?: string;
}): Promise<ResultadoMasivo> {
  const usuario = await requerirUsuario('JEFE');

  const tipoTareaId = parsearId(input.tipo_tarea_id);
  const personaId = parsearId(input.persona_id);
  if (!tipoTareaId) return { error: 'Tipo de tarea inválido.', creadas: 0, duplicadas: 0 };
  if (!personaId) return { error: 'Persona inválida.', creadas: 0, duplicadas: 0 };
  if (input.destinos.length === 0) {
    return { error: 'Selecciona al menos un destino.', creadas: 0, duplicadas: 0 };
  }

  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: tipoTareaId },
    select: { area: true, activo: true, nombre: true },
  });
  if (!tipo || !tipo.activo) {
    return { error: 'Tipo de tarea no válido o inactivo.', creadas: 0, duplicadas: 0 };
  }

  const kindEsperado = tipo.area === 'CULTIVO' ? 'lote' : 'apiario';
  if (input.destinos.some((d) => d.kind !== kindEsperado)) {
    return {
      error: `Los destinos deben ser ${
        kindEsperado === 'lote' ? 'lotes' : 'apiarios'
      } para esta tarea.`,
      creadas: 0,
      duplicadas: 0,
    };
  }

  const idsParsados: bigint[] = [];
  for (const d of input.destinos) {
    const id = parsearId(d.id);
    if (!id) {
      return { error: 'Algún destino tiene id inválido.', creadas: 0, duplicadas: 0 };
    }
    idsParsados.push(id);
  }

  let fechaInicio = new Date();
  if (input.fecha_inicio) {
    const f = new Date(input.fecha_inicio);
    if (Number.isNaN(f.getTime())) {
      return { error: 'Fecha de inicio inválida.', creadas: 0, duplicadas: 0 };
    }
    const limite = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (f > limite) {
      return {
        error: 'La fecha de inicio no puede ser de más de un año en el futuro.',
        creadas: 0,
        duplicadas: 0,
      };
    }
    fechaInicio = f;
  }

  // Filtrar destinos que ya tienen una asignación abierta del mismo tipo
  const abiertas = await prisma.asignaciones.findMany({
    where: {
      tipo_tarea_id: tipoTareaId,
      estado: { in: ['PENDIENTE', 'EN_CURSO'] },
      ...(kindEsperado === 'lote'
        ? { lote_id: { in: idsParsados } }
        : { apiario_id: { in: idsParsados } }),
    },
    select: { lote_id: true, apiario_id: true },
  });
  const ocupados = new Set(
    abiertas.map((a) => (kindEsperado === 'lote' ? String(a.lote_id) : String(a.apiario_id)))
  );

  const aCrear = idsParsados.filter((id) => !ocupados.has(String(id)));
  const duplicadas = idsParsados.length - aCrear.length;

  if (aCrear.length === 0) {
    return {
      error: 'Todos los destinos ya tienen una asignación abierta de este tipo.',
      creadas: 0,
      duplicadas,
    };
  }

  let creadas: { id: bigint }[] = [];
  try {
    creadas = await prisma.$transaction(
      aCrear.map((destinoId) =>
        prisma.asignaciones.create({
          data: {
            persona_id: personaId,
            lote_id: kindEsperado === 'lote' ? destinoId : null,
            apiario_id: kindEsperado === 'apiario' ? destinoId : null,
            tipo_tarea_id: tipoTareaId,
            fecha_inicio: fechaInicio,
            estado: 'PENDIENTE',
            creado_por_usuario_id: usuario.id,
          },
          select: { id: true },
        })
      )
    );
  } catch (e) {
    return {
      error: sanitizarError(e, 'jefe/asignaciones/crearMasivas'),
      creadas: 0,
      duplicadas,
    };
  }

  try {
    const destinatario = await prisma.usuarios.findFirst({
      where: { persona_id: personaId, activo: true },
      select: { id: true },
    });
    if (destinatario) {
      const { enviarPushAUsuarios } = await import('@/lib/push/enviar');
      await enviarPushAUsuarios([destinatario.id], {
        titulo: `${creadas.length} nuevas tareas asignadas`,
        cuerpo: `${tipo.nombre} · ${creadas.length} ${
          kindEsperado === 'lote' ? 'lotes' : 'apiarios'
        }`,
        url: '/trabajador',
        tag: `asignacion-masiva-${tipoTareaId}-${personaId}`,
      });
    }
  } catch (e) {
    console.warn('Push asignación masiva falló:', e);
  }

  revalidatePath('/jefe');
  revalidatePath('/jefe/asignaciones');
  revalidatePath('/jefe/alertas');
  revalidatePath('/trabajador');

  return { error: null, creadas: creadas.length, duplicadas };
}

export async function cancelarAsignacion(formData: FormData) {
  await requerirUsuario('JEFE');
  const id = parsearId(String(formData.get('asignacion_id') ?? ''));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: 'CANCELADA' },
  });
  revalidatePath('/jefe/asignaciones');
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath('/trabajador');
}

export async function reabrirAsignacion(formData: FormData) {
  await requerirUsuario('JEFE');
  const id = parsearId(String(formData.get('asignacion_id') ?? ''));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: 'EN_CURSO', fecha_completada: null },
  });
  revalidatePath('/jefe/asignaciones');
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath('/trabajador');
}

export async function editarAsignacion(
  _prev: EstadoAsignacion,
  formData: FormData
): Promise<EstadoAsignacion> {
  await requerirUsuario('JEFE');

  const id = parsearId(String(formData.get('id') ?? ''));
  if (!id) return { error: 'Asignación no válida.' };

  const personaId = parsearId(String(formData.get('persona_id') ?? ''));
  if (!personaId) return { error: 'Seleccioná una persona.' };

  const fechaInicioRaw = String(formData.get('fecha_inicio') ?? '').trim();

  // Verificar que la asignación existe y está en estado editable
  const asignacion = await prisma.asignaciones.findUnique({
    where: { id },
    select: { estado: true, persona_id: true },
  });
  if (!asignacion) return { error: 'Asignación no encontrada.' };
  if (asignacion.estado === 'COMPLETADA' || asignacion.estado === 'CANCELADA') {
    return { error: 'No se puede editar una asignación completada o cancelada.' };
  }

  // Si se está reasignando a otra persona, verificar que no haya avances
  const personaCambia = asignacion.persona_id !== personaId;
  if (personaCambia) {
    const cantidadAvances = await prisma.registros_avance.count({
      where: { asignacion_id: id },
    });
    if (cantidadAvances > 0) {
      return {
        error:
          'No se puede reasignar: ya hay avances registrados. Cancelá y creá una nueva si es necesario.',
      };
    }
  }

  let fecha_inicio: Date | undefined;
  if (fechaInicioRaw) {
    const f = new Date(fechaInicioRaw);
    if (Number.isNaN(f.getTime())) return { error: 'Fecha de inicio inválida.' };
    const limite = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (f > limite) {
      return { error: 'La fecha de inicio no puede ser de más de un año en el futuro.' };
    }
    fecha_inicio = f;
  }

  try {
    await prisma.asignaciones.update({
      where: { id },
      data: {
        persona_id: personaId,
        ...(fecha_inicio !== undefined ? { fecha_inicio } : {}),
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, 'jefe/asignaciones/editar') };
  }

  revalidatePath('/jefe/asignaciones');
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath('/trabajador');
  redirect(`/jefe/asignaciones/${id}`);
}
