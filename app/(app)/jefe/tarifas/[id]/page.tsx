import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarTarifa } from './FormularioEditarTarifa';

export const metadata = { title: 'Editar tarifa' };

export default async function PaginaEditarTarifa({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const [tarifa, tipos, lotes] = await Promise.all([
    prisma.tarifas_tarea.findFirst({
      where: { id, borrado_en: null },
      include: {
        tipos_tarea: { select: { nombre: true, area: true } },
        lotes: { select: { nombre: true } },
      },
    }),
    prisma.tipos_tarea.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, area: true },
      orderBy: [{ area: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  if (!tarifa) notFound();

  return (
    <FormularioEditarTarifa
      id={String(tarifa.id)}
      tipoTareaIdInicial={String(tarifa.tipo_tarea_id)}
      esquemaPagoInicial={tarifa.esquema_pago}
      montoInicial={Number(tarifa.monto)}
      unidadInicial={tarifa.unidad ?? ''}
      vigenteDesdIso={tarifa.vigente_desde.toISOString().slice(0, 10)}
      vigenteHastaIso={tarifa.vigente_hasta ? tarifa.vigente_hasta.toISOString().slice(0, 10) : ''}
      loteIdInicial={tarifa.lote_id ? String(tarifa.lote_id) : ''}
      notasIniciales={tarifa.notas ?? ''}
      tipos={tipos.map((t) => ({ id: String(t.id), nombre: t.nombre, area: t.area }))}
      lotes={lotes.map((l) => ({ id: String(l.id), nombre: l.nombre }))}
    />
  );
}
