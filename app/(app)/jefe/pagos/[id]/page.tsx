import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarPago } from './FormularioEditarPago';

export const metadata = { title: 'Editar pago' };

export default async function PaginaEditarPago({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const [pago, servicios] = await Promise.all([
    prisma.pagos.findUnique({
      where: { id, borrado_en: null },
      include: { persona: { select: { nombre_completo: true } } },
    }),
    prisma.servicios_contratados.findMany({
      where: { estado: { in: ['ACUERDO', 'EN_CURSO'] } },
      select: {
        id: true,
        descripcion: true,
        persona_id: true,
        persona: { select: { nombre_completo: true } },
      },
      orderBy: { fecha_inicio: 'desc' },
    }),
  ]);
  if (!pago) notFound();

  return (
    <FormularioEditarPago
      id={String(pago.id)}
      nombrePersona={pago.persona.nombre_completo}
      tipoInicial={pago.tipo}
      montoInicial={Number(pago.monto)}
      fechaInicial={pago.fecha.toISOString().slice(0, 10)}
      metodoPagoInicial={pago.metodo_pago ?? ''}
      cubreDesdeInicial={pago.cubre_desde ? pago.cubre_desde.toISOString().slice(0, 10) : ''}
      cubreHastaInicial={pago.cubre_hasta ? pago.cubre_hasta.toISOString().slice(0, 10) : ''}
      motivoDiferenciaInicial={pago.motivo_diferencia ?? ''}
      notasIniciales={pago.notas ?? ''}
      servicioIdInicial={pago.servicio_id ? String(pago.servicio_id) : ''}
      servicios={servicios.map((s) => ({
        id: String(s.id),
        descripcion: s.descripcion,
        persona_nombre: s.persona.nombre_completo,
      }))}
    />
  );
}
