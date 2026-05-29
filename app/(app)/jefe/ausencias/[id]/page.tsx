import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarAusencia } from './FormularioEditarAusencia';

export const metadata = { title: 'Editar ausencia' };

export default async function PaginaEditarAusencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const ausencia = await prisma.ausencias.findFirst({
    where: { id, borrado_en: null },
    include: {
      persona: { select: { nombre_completo: true } },
    },
  });
  if (!ausencia) notFound();

  return (
    <FormularioEditarAusencia
      id={String(ausencia.id)}
      nombrePersona={ausencia.persona.nombre_completo}
      fechaIso={ausencia.fecha.toISOString().slice(0, 10)}
      tipoInicial={ausencia.tipo}
      descontableInicial={ausencia.descontable}
      observacionesIniciales={ausencia.observaciones ?? ''}
    />
  );
}
