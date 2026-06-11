import 'server-only';
import { prisma } from '@/lib/prisma';
import { enviarPushAUsuarios } from '@/lib/push/enviar';
import { obtenerClimaFinca } from '@/lib/jefe/clima';

/**
 * Evalúa las reglas agro del día y, si hay algo que avisar, manda push a
 * todos los jefes. Se llama desde el cron de las 7 am (Vercel Hobby solo
 * permite 2 crons, así que comparte el de recordatorios).
 */
export async function evaluarYEnviarAlertaClima(): Promise<{
  enviada: boolean;
  motivo: string;
}> {
  let clima;
  try {
    clima = await obtenerClimaFinca();
  } catch {
    return { enviada: false, motivo: 'pronóstico no disponible' };
  }

  const avisos: string[] = [];
  if (clima.reglas.riesgo_helada) avisos.push('Riesgo de helada esta noche');
  if (!clima.reglas.ventana_fumigacion) avisos.push(clima.reglas.motivo);
  if (avisos.length === 0) return { enviada: false, motivo: 'sin alertas' };

  const jefes = await prisma.usuarios.findMany({
    where: { rol: 'JEFE', activo: true },
    select: { id: true },
  });
  if (jefes.length === 0) return { enviada: false, motivo: 'sin jefes' };

  await enviarPushAUsuarios(
    jefes.map((j) => j.id),
    {
      titulo: 'Clima de hoy en la finca',
      cuerpo: avisos.join(' · '),
      url: '/jefe',
      tag: 'alerta-clima',
    }
  );
  return { enviada: true, motivo: avisos.join(' · ') };
}
