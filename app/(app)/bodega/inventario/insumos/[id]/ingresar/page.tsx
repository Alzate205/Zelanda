import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioIngresoStock } from "./_formulario";

export const metadata = { title: "Ingresar stock" };

export default async function PaginaIngresarStock({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const insumo = await prisma.insumos.findUnique({ where: { id: BigInt(id) } });
  if (!insumo) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Ingresar stock
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {insumo.nombre} ({insumo.unidad})
        </p>
      </header>
      <FormularioIngresoStock
        insumoId={insumo.id.toString()}
        unidad={insumo.unidad}
      />
    </div>
  );
}
