import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { carenciasPorLote, diaBogota, type CarenciaLote } from '@/lib/carencia';

const obtenerCarenciasUncached = async (): Promise<CarenciaLote[]> => {
  // 90 días cubre cualquier carencia razonable (las etiquetas van de 1 a ~30 días) y el formulario de insumos rechaza valores mayores a 90.
  const desde = new Date(Date.now() - 90 * 86400000);
  const items = await prisma.despacho_items.findMany({
    where: {
      tipo_item: 'INSUMO',
      cantidad_consumida: { gt: 0 },
      insumos: { periodo_carencia_dias: { gt: 0 } },
      despachos: { estado: 'CERRADO', lote_id: { not: null }, fecha: { gte: desde } },
    },
    select: {
      insumos: { select: { nombre: true, periodo_carencia_dias: true } },
      despachos: { select: { fecha: true, lote_id: true } },
    },
  });

  const hoy = diaBogota(new Date());
  return carenciasPorLote(
    items.map((it) => ({
      lote_id: it.despachos.lote_id!.toString(),
      insumo: it.insumos?.nombre ?? '?',
      fecha_aplicacion: it.despachos.fecha,
      carencia_dias: it.insumos?.periodo_carencia_dias ?? 0,
    })),
    hoy
  );
};

/** Lotes en carencia activa. Cache corto: una ventana de días tolera 5 min. */
export const carenciasActivas = unstable_cache(obtenerCarenciasUncached, ['carencias-activas'], {
  revalidate: 300,
});
