import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { carenciasActivas } from '@/lib/jefe/carencias';
import { FormularioCosecha } from './_formulario';

export const metadata = { title: 'Nueva cosecha' };

export default async function PaginaNuevaCosecha() {
  await requerirUsuario('ALMACEN');

  const [personas, lotes, config, carencias] = await Promise.all([
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: 'asc' },
      select: { id: true, nombre_completo: true },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    obtenerConfiguracion(),
    carenciasActivas(),
  ]);

  // Tareas de cultivo abiertas: es lo que permite atar los kilos a la tarea
  // que los produjo, y que el jefe los vea en el detalle de esa tarea.
  const tareasAbiertas = await prisma.asignaciones.findMany({
    where: { estado: { in: ['PENDIENTE', 'EN_CURSO'] }, lote_id: { not: null } },
    orderBy: { fecha_inicio: 'desc' },
    take: 50,
    select: {
      id: true,
      lote_id: true,
      persona_id: true,
      tipos_tarea: { select: { nombre: true } },
      persona: { select: { nombre_completo: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Almacén</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Nueva cosecha</h1>
      </header>
      <FormularioCosecha
        personas={personas.map((p) => ({
          id: p.id.toString(),
          nombre: p.nombre_completo,
        }))}
        lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))}
        tareas={tareasAbiertas.map((t) => ({
          id: t.id.toString(),
          lote_id: t.lote_id!.toString(),
          persona_id: t.persona_id.toString(),
          etiqueta: `${t.tipos_tarea.nombre} · ${t.persona.nombre_completo}`,
        }))}
        canastaPorDefecto={Number(config.canasta_kg_default)}
        carencias={carencias}
      />
    </div>
  );
}
