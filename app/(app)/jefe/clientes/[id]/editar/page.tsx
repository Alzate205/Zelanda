import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCliente } from "../../_FormularioCliente";

export const metadata = { title: "Editar cliente" };

export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const cliente = await prisma.clientes.findUnique({ where: { id } });
  if (!cliente) notFound();

  return (
    <FormularioCliente
      modo="editar"
      cliente={{
        id: String(cliente.id),
        nombre: cliente.nombre,
        contacto: cliente.contacto,
        telefono: cliente.telefono,
        notas: cliente.notas,
        activo: cliente.activo,
      }}
    />
  );
}
