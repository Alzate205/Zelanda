import { notFound } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormularioEditarCompra } from './FormularioEditarCompra';

export const metadata = { title: 'Editar compra' };

export default async function PaginaEditarCompra({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario('JEFE');
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const compra = await prisma.compras.findFirst({
    where: { id, borrado_en: null },
    include: { proveedor: { select: { id: true, nombre: true } } },
  });
  if (!compra) notFound();

  const proveedores = await prisma.proveedores.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  return (
    <FormularioEditarCompra
      id={String(compra.id)}
      proveedorIdInicial={compra.proveedor_id ? String(compra.proveedor_id) : ''}
      proveedorNombreInicial={compra.proveedor?.nombre ?? compra.proveedor_detalle ?? ''}
      fechaIso={compra.fecha.toISOString().slice(0, 10)}
      numeroFacturaInicial={compra.numero_factura ?? ''}
      notasIniciales={compra.notas ?? ''}
      proveedores={proveedores.map((p) => ({ id: String(p.id), nombre: p.nombre }))}
    />
  );
}
