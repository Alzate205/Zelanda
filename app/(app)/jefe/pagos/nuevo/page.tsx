import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioPago } from './FormularioPago';

export const metadata = { title: 'Nuevo pago' };

type Tipo = 'SALARIO' | 'ADELANTO' | 'JORNAL' | 'SERVICIO' | 'BONO' | 'AJUSTE' | 'OTRO';
const TIPOS_VALIDOS: Tipo[] = [
  'SALARIO',
  'ADELANTO',
  'JORNAL',
  'SERVICIO',
  'BONO',
  'AJUSTE',
  'OTRO',
];

export default async function PaginaNuevoPago({
  searchParams,
}: {
  searchParams: Promise<{ persona_id?: string; tipo?: string; servicio_id?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const personaIdInicial = sp.persona_id && /^\d+$/.test(sp.persona_id) ? sp.persona_id : null;
  const tipoInicial: Tipo = TIPOS_VALIDOS.includes(sp.tipo as Tipo) ? (sp.tipo as Tipo) : 'SALARIO';
  const servicioIdInicial = sp.servicio_id && /^\d+$/.test(sp.servicio_id) ? sp.servicio_id : null;

  const [personas, servicios] = await Promise.all([
    prisma.personas.findMany({
      where: { deleted_at: null, activo: true },
      select: {
        id: true,
        nombre_completo: true,
        // La vinculación abierta trae el salario pactado: sirve para proponer el
        // monto sin que el jefe lo escriba de memoria.
        vinculaciones: {
          where: { fecha_fin: null },
          select: { salario_base: true, periodo_pago: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
      },
      orderBy: { nombre_completo: 'asc' },
    }),
    prisma.servicios_contratados.findMany({
      where: { estado: { in: ['ACUERDO', 'EN_CURSO'] } },
      select: {
        id: true,
        descripcion: true,
        persona_id: true,
        monto_pactado: true,
        persona: { select: { nombre_completo: true } },
      },
      orderBy: { fecha_inicio: 'desc' },
    }),
  ]);

  return (
    <FormularioPago
      personas={personas.map((p) => {
        const v = p.vinculaciones[0];
        return {
          id: String(p.id),
          nombre: p.nombre_completo,
          salarioBase: v?.salario_base != null ? Number(v.salario_base) : null,
          periodoPago: v?.periodo_pago ?? null,
        };
      })}
      servicios={servicios.map((s) => ({
        id: String(s.id),
        descripcion: s.descripcion,
        persona_id: String(s.persona_id),
        persona_nombre: s.persona.nombre_completo,
        monto_pactado: Number(s.monto_pactado),
      }))}
      personaIdInicial={personaIdInicial}
      tipoInicial={tipoInicial}
      servicioIdInicial={servicioIdInicial}
    />
  );
}
