import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { estadoDeTareas } from '@/lib/fechas-tarea';
import { construirAvisoTareas } from '@/lib/jefe/aviso-tareas';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { enviarPushAUsuarios } from '@/lib/push/enviar';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const config = await obtenerConfiguracion();

  const [lotes, tiposCultivo, frecuenciasOverride, completadasLote] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: 'CULTIVO', activo: true },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.frecuencias_lote.findMany({
      select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
    }),
    prisma.asignaciones.groupBy({
      by: ['lote_id', 'tipo_tarea_id'],
      where: { estado: 'COMPLETADA', lote_id: { not: null } },
      _max: { fecha_completada: true },
    }),
  ]);

  const estados = estadoDeTareas({
    destinos: lotes.map((l) => String(l.id)),
    tipos: tiposCultivo.map((t) => ({
      id: String(t.id),
      frecuencia_dias_default: t.frecuencia_dias_default,
    })),
    frecuenciasPropias: frecuenciasOverride.map((f) => ({
      destino_id: String(f.lote_id),
      tipo_tarea_id: String(f.tipo_tarea_id),
      frecuencia_dias: f.frecuencia_dias,
    })),
    ultimas: completadasLote
      .filter((c) => c.lote_id !== null)
      .map((c) => ({
        destino_id: String(c.lote_id),
        tipo_tarea_id: String(c.tipo_tarea_id),
        fecha: c._max.fecha_completada,
      })),
    diasAlerta: config.alerta_dias_anticipacion,
  });

  const aviso = construirAvisoTareas(estados, {
    lote: (id) => lotes.find((l) => String(l.id) === id)?.nombre,
    tipo: (id) => tiposCultivo.find((t) => String(t.id) === id)?.nombre,
  });

  if (!aviso.hayAlgoQueDecir) {
    return NextResponse.json({ enviado: false, motivo: 'nada-que-reportar' });
  }

  const jefes = await prisma.usuarios.findMany({
    where: { rol: 'JEFE', activo: true },
    select: { id: true },
  });
  if (jefes.length === 0) {
    return NextResponse.json({ enviado: false, motivo: 'sin-jefes-activos' });
  }

  await enviarPushAUsuarios(
    jefes.map((j) => j.id),
    {
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      url: '/jefe/alertas',
      tag: 'resumen-diario',
    }
  );

  return NextResponse.json({ enviado: true, ...aviso });
}
