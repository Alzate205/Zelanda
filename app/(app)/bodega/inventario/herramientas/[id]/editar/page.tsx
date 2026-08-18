import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioHerramienta } from '../../_formulario';
import { ToggleActivoHerramienta } from '../../../toggles';

export const metadata = { title: 'Editar herramienta' };

export default async function PaginaEditarHerramienta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario('BODEGA');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const h = await prisma.herramientas.findUnique({ where: { id: BigInt(id) } });
  if (!h) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Editar herramienta</h1>
      </header>
      <FormularioHerramienta
        modo="editar"
        valores={{
          id: h.id.toString(),
          nombre: h.nombre,
          categoria: h.categoria,
          total: h.total,
        }}
      />

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          {h.activo ? '¿Te equivocaste al crearla?' : 'Herramienta dada de baja'}
        </h2>
        <div className="mt-3">
          <ToggleActivoHerramienta id={h.id.toString()} activo={h.activo} />
        </div>
      </section>
    </div>
  );
}
