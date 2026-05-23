import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioInsumo } from "../../_formulario";

export const metadata = { title: "Editar insumo" };

export default async function PaginaEditarInsumo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const i = await prisma.insumos.findUnique({ where: { id: BigInt(id) } });
  if (!i) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Editar insumo
        </h1>
      </header>
      <FormularioInsumo
        modo="editar"
        valores={{
          id: i.id.toString(),
          nombre: i.nombre,
          categoria: i.categoria,
          unidad: i.unidad,
          stock_minimo: i.stock_minimo.toString(),
          costo_unitario: i.costo_unitario?.toString() ?? null,
        }}
      />
    </div>
  );
}
