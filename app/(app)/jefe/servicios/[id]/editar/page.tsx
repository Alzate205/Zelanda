import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarServicio } from './FormularioEditarServicio';

export const metadata = { title: 'Editar servicio' };

export default async function PaginaEditarServicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const [servicio, lotes] = await Promise.all([
    prisma.servicios_contratados.findUnique({
      where: { id, borrado_en: null },
      select: {
        id: true,
        descripcion: true,
        lote_id: true,
        monto_pactado: true,
        fecha_inicio: true,
        fecha_fin: true,
        notas: true,
      },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  if (!servicio) notFound();

  return (
    <FormularioEditarServicio
      servicio={{
        id: String(servicio.id),
        descripcion: servicio.descripcion,
        lote_id: servicio.lote_id ? String(servicio.lote_id) : '',
        monto_pactado: String(servicio.monto_pactado),
        fecha_inicio: servicio.fecha_inicio.toISOString().slice(0, 10),
        fecha_fin: servicio.fecha_fin ? servicio.fecha_fin.toISOString().slice(0, 10) : '',
        notas: servicio.notas ?? '',
      }}
      lotes={lotes.map((l) => ({ id: String(l.id), nombre: l.nombre }))}
    />
  );
}
