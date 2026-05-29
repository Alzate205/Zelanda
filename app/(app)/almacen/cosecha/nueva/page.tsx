import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { FormularioCosecha } from './_formulario';

export const metadata = { title: 'Nueva cosecha' };

export default async function PaginaNuevaCosecha() {
  await requerirUsuario('ALMACEN');

  const [personas, lotes, config] = await Promise.all([
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
  ]);

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
        canastaPorDefecto={Number(config.canasta_kg_default)}
      />
    </div>
  );
}
