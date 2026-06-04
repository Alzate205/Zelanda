import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarAsignacion } from './FormularioEditarAsignacion';

export const metadata: Metadata = { title: 'Editar asignación' };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

const ETIQUETA_VINC: Record<string, string> = {
  FIJO: 'Fijo',
  JORNALERO: 'Jornalero',
  CONTRATISTA: 'Contratista',
  FAMILIAR: 'Familiar',
};

export default async function PaginaEditarAsignacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  const id = parsearId(idRaw);
  if (!id) notFound();

  const asignacion = await prisma.asignaciones.findUnique({
    where: { id },
    include: {
      persona: { select: { id: true, nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true } },
    },
  });
  if (!asignacion) notFound();

  // Si ya está terminada/cancelada, redirigir al detalle
  if (asignacion.estado === 'COMPLETADA' || asignacion.estado === 'CANCELADA') {
    redirect(`/jefe/asignaciones/${idRaw}`);
  }

  // Nombre del apiario si aplica
  let apiarioNombre: string | null = null;
  if (asignacion.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: asignacion.apiario_id },
      select: { nombre: true },
    });
    apiarioNombre = ap?.nombre ?? null;
  }

  // Contar avances para saber si se puede reasignar
  const cantidadAvances = await prisma.registros_avance.count({
    where: { asignacion_id: id },
  });

  // Personas activas con vinculación activa
  const personas = await prisma.personas.findMany({
    where: {
      deleted_at: null,
      activo: true,
      vinculaciones: { some: { fecha_fin: null } },
    },
    select: {
      id: true,
      nombre_completo: true,
      vinculaciones: {
        where: { fecha_fin: null },
        select: { tipo: true, rol_finca: true },
        take: 1,
      },
    },
    orderBy: { nombre_completo: 'asc' },
  });

  const destinoNombre = asignacion.lotes?.nombre ?? apiarioNombre ?? '—';
  const destinoTipo = asignacion.lote_id ? 'Lote' : 'Apiario';

  return (
    <FormularioEditarAsignacion
      id={idRaw}
      destinoLabel={`${destinoTipo}: ${destinoNombre}`}
      tipoTareaNombre={asignacion.tipos_tarea.nombre}
      personaIdActual={String(asignacion.persona_id)}
      fechaInicioIso={asignacion.fecha_inicio.toISOString().slice(0, 10)}
      puedeReasignar={cantidadAvances === 0}
      personas={personas.map((p) => {
        const v = p.vinculaciones[0];
        return {
          id: String(p.id),
          nombre_completo: p.nombre_completo,
          vinculo: v ? ETIQUETA_VINC[v.tipo] ?? v.tipo : '—',
        };
      })}
    />
  );
}
