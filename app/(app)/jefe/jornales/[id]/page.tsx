import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarJornal } from './FormularioEditarJornal';

export const metadata = { title: 'Editar jornal' };

export default async function PaginaEditarJornal({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const jornal = await prisma.jornales.findUnique({
    where: { id, borrado_en: null },
    include: {
      persona: { select: { nombre_completo: true } },
      lotes: { select: { nombre: true } },
    },
  });
  if (!jornal) notFound();

  const lotes = await prisma.lotes.findMany({
    where: { deleted_at: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  return (
    <FormularioEditarJornal
      id={String(jornal.id)}
      nombrePersona={jornal.persona.nombre_completo}
      fechaIso={jornal.fecha.toISOString().slice(0, 10)}
      tarifaInicial={Number(jornal.tarifa_aplicada)}
      loteIdInicial={jornal.lote_id ? String(jornal.lote_id) : ''}
      descripcionInicial={jornal.descripcion_actividad ?? ''}
      notasIniciales={jornal.notas ?? ''}
      lotes={lotes.map((l) => ({ id: String(l.id), nombre: l.nombre }))}
    />
  );
}
