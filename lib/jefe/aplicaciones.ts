import 'server-only';
import { prisma } from '@/lib/prisma';
import { costoAplicacion } from '@/lib/aplicaciones';

export type Aplicacion = {
  id: string; // despacho_item_id
  despacho_id: string;
  fecha: Date; // fecha del despacho = día del trabajo
  insumo: string;
  unidad: string;
  cantidad: number;
  lote_id: string | null;
  lote: string | null;
  persona: string;
  tarea: string | null;
  costo: number;
};

/** Registro de aplicaciones: items insumo consumidos de despachos cerrados. */
export async function obtenerAplicaciones(desde: Date, hasta: Date): Promise<Aplicacion[]> {
  const items = await prisma.despacho_items.findMany({
    where: {
      tipo_item: 'INSUMO',
      cantidad_consumida: { gt: 0 },
      despachos: { estado: 'CERRADO', fecha: { gte: desde, lte: hasta } },
    },
    include: {
      insumos: { select: { nombre: true, unidad: true, costo_unitario: true } },
      despachos: {
        select: {
          id: true,
          fecha: true,
          lote_id: true,
          lotes: { select: { nombre: true } },
          persona: { select: { nombre_completo: true } },
          asignacion: { select: { tipos_tarea: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { despachos: { fecha: 'desc' } },
  });

  return items.map((it) => ({
    id: it.id.toString(),
    despacho_id: it.despachos.id.toString(),
    fecha: it.despachos.fecha,
    insumo: it.insumos?.nombre ?? '?',
    unidad: it.insumos?.unidad ?? '',
    cantidad: Number(it.cantidad_consumida ?? 0),
    lote_id: it.despachos.lote_id?.toString() ?? null,
    lote: it.despachos.lotes?.nombre ?? null,
    persona: it.despachos.persona.nombre_completo,
    tarea: it.despachos.asignacion?.tipos_tarea?.nombre ?? null,
    costo: costoAplicacion(
      Number(it.cantidad_consumida ?? 0),
      it.costo_unitario_snapshot === null ? null : Number(it.costo_unitario_snapshot),
      it.insumos?.costo_unitario == null ? null : Number(it.insumos.costo_unitario)
    ),
  }));
}
