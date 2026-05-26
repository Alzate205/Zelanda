import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcularResumen } from '@/lib/fechas-tarea';
import { enviarPushAUsuarios } from '@/lib/push/enviar';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const [lotes, tiposCultivo, frecuenciasOverride, completadasLote] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: 'CULTIVO', activo: true },
      select: { id: true, frecuencia_dias_default: true },
    }),
    prisma.frecuencias_lote.findMany({
      select: {
        lote_id: true,
        tipo_tarea_id: true,
        frecuencia_dias: true,
      },
    }),
    prisma.asignaciones.groupBy({
      by: ['lote_id', 'tipo_tarea_id'],
      where: { estado: 'COMPLETADA', lote_id: { not: null } },
      _max: { fecha_completada: true },
    }),
  ]);

  const mapaFreq = new Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }
  const mapaUlt = new Map<string, Date | null>();
  for (const c of completadasLote) {
    if (c.lote_id) {
      mapaUlt.set(`${c.lote_id}_${c.tipo_tarea_id}`, c._max.fecha_completada);
    }
  }

  let totalVencidas = 0;
  let totalProximas = 0;
  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUlt.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const r = calcularResumen(ultima, freq);
      if (r.estado === 'vencida' || r.estado === 'sin_historial') totalVencidas++;
      else if (r.estado === 'proxima') totalProximas++;
    }
  }

  if (totalVencidas + totalProximas === 0) {
    return NextResponse.json({ enviado: false, motivo: 'nada-que-reportar' });
  }

  const jefes = await prisma.usuarios.findMany({
    where: { rol: 'JEFE', activo: true },
    select: { id: true },
  });
  if (jefes.length === 0) {
    return NextResponse.json({ enviado: false, motivo: 'sin-jefes-activos' });
  }

  const cuerpoPartes: string[] = [];
  if (totalVencidas > 0) {
    cuerpoPartes.push(`${totalVencidas} vencida${totalVencidas === 1 ? '' : 's'}`);
  }
  if (totalProximas > 0) {
    cuerpoPartes.push(`${totalProximas} próxima${totalProximas === 1 ? '' : 's'}`);
  }

  await enviarPushAUsuarios(
    jefes.map((j) => j.id),
    {
      titulo: 'Resumen del día',
      cuerpo: cuerpoPartes.join(', '),
      url: '/jefe',
      tag: 'resumen-diario',
    }
  );

  return NextResponse.json({ enviado: true, totalVencidas, totalProximas });
}
