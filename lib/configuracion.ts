import 'server-only';
import { prisma } from './prisma';

export async function obtenerConfiguracion() {
  const config = await prisma.configuracion_finca.findUnique({
    where: { id: 1 },
    include: {
      updated_by_u: { select: { nombre_completo: true } },
    },
  });
  if (!config) throw new Error('Fila configuracion_finca no encontrada. Corré la migración.');
  return config;
}
