import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enviarPushAUsuarios } from '@/lib/push/enviar';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  // Recordatorios pendientes para hoy que aún no se notificaron
  const pendientes = await prisma.recordatorios.findMany({
    where: {
      completado_en: null,
      fecha: { gte: hoy, lt: manana },
      push_enviado_en: null,
    },
    include: {
      asignado_a: {
        select: {
          id: true,
          nombre_completo: true,
          usuarios: { where: { activo: true }, select: { id: true } },
        },
      },
    },
  });

  let enviados = 0;
  let sinUsuario = 0;
  const errores: string[] = [];

  for (const r of pendientes) {
    const usuarioId = r.asignado_a.usuarios[0]?.id;
    if (!usuarioId) {
      sinUsuario++;
      continue;
    }
    try {
      await enviarPushAUsuarios([usuarioId], {
        titulo: 'Recordatorio para hoy',
        cuerpo: r.titulo,
        url: '/recordatorios',
        tag: `recordatorio-${r.id}`,
      });
      await prisma.recordatorios.update({
        where: { id: r.id },
        data: { push_enviado_en: new Date() },
      });
      enviados++;
    } catch (e) {
      errores.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Recordatorios vencidos (no notificados, fecha < hoy, sin completar)
  // Solo notificamos el día después de vencer para no spammear
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const vencidosAyer = await prisma.recordatorios.findMany({
    where: {
      completado_en: null,
      fecha: { gte: ayer, lt: hoy },
      push_enviado_en: { lt: hoy },
    },
    include: {
      asignado_a: {
        select: {
          usuarios: { where: { activo: true }, select: { id: true } },
        },
      },
    },
    take: 50,
  });

  let vencidos = 0;
  for (const r of vencidosAyer) {
    const usuarioId = r.asignado_a.usuarios[0]?.id;
    if (!usuarioId) continue;
    try {
      await enviarPushAUsuarios([usuarioId], {
        titulo: 'Recordatorio vencido',
        cuerpo: `Ayer: ${r.titulo}`,
        url: '/recordatorios',
        tag: `recordatorio-vencido-${r.id}`,
      });
      await prisma.recordatorios.update({
        where: { id: r.id },
        data: { push_enviado_en: new Date() },
      });
      vencidos++;
    } catch (e) {
      errores.push(`vencido ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    procesados: pendientes.length + vencidosAyer.length,
    enviados,
    vencidos,
    sin_usuario: sinUsuario,
    errores,
  });
}
