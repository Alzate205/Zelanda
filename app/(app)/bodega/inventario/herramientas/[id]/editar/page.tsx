import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioHerramienta } from "../../_formulario";

export const metadata = { title: "Editar herramienta" };

export default async function PaginaEditarHerramienta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const h = await prisma.herramientas.findUnique({ where: { id: BigInt(id) } });
  if (!h) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Editar herramienta
        </h1>
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
    </div>
  );
}
