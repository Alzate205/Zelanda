import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioProveedor } from "../../_FormularioProveedor";

export const metadata = { title: "Editar proveedor" };

export default async function PaginaEditarProveedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const proveedor = await prisma.proveedores.findUnique({ where: { id } });
  if (!proveedor) notFound();

  return (
    <FormularioProveedor
      modo="editar"
      proveedor={{
        id: String(proveedor.id),
        nombre: proveedor.nombre,
        contacto: proveedor.contacto,
        telefono: proveedor.telefono,
        nit: proveedor.nit,
        notas: proveedor.notas,
        activo: proveedor.activo,
      }}
    />
  );
}
