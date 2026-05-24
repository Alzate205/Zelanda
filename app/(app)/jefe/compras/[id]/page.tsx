import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Package, FileText } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { borrarCompra } from "../acciones";

export const metadata = { title: "Compra" };
export const dynamic = "force-dynamic";

function fmtMonto(n: number): string {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function PaginaDetalleCompra({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id: idRaw } = await params;
  if (!/^\d+$/.test(idRaw)) notFound();
  const id = BigInt(idRaw);

  const compra = await prisma.compras.findUnique({
    where: { id },
    include: {
      proveedor: { select: { id: true, nombre: true, nit: true } },
      items: {
        include: { insumo: { select: { nombre: true, unidad: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!compra) notFound();

  const total = Number(compra.total);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/compras"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Compras
      </Link>

      <header>
        <Eyebrow>
          {compra.proveedor
            ? compra.proveedor.nombre
            : compra.proveedor_detalle ?? "(sin proveedor)"}
        </Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {fmtMonto(total)}
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {fmtFecha(compra.fecha)}
          {compra.numero_factura ? ` · Factura ${compra.numero_factura}` : ""}
        </p>
      </header>

      {compra.proveedor?.nit ? (
        <p className="rounded-[10px] bg-zelanda-beige-100 px-3 py-2 text-[12.5px] text-zelanda-verde-800">
          <FileText className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
          NIT {compra.proveedor.nit}
        </p>
      ) : null}

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          {compra.items.length} {compra.items.length === 1 ? "item" : "items"}
        </h2>
        <ul className="space-y-2">
          {compra.items.map((it) => (
            <li
              key={String(it.id)}
              className="rounded-[10px] border border-zelanda-beige-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-serif text-[14.5px] text-zelanda-verde-900">
                    {it.insumo.nombre}
                  </p>
                  <p className="m-0 mt-0.5 flex items-center gap-1 text-[11.5px] text-zelanda-verde-700">
                    <Package className="h-3 w-3" />
                    {Number(it.cantidad).toLocaleString("es-CO", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {it.insumo.unidad} ×{" "}
                    {fmtMonto(Number(it.costo_unitario))}
                  </p>
                </div>
                <span className="font-serif text-[15px] text-zelanda-verde-900">
                  {fmtMonto(Number(it.subtotal))}
                </span>
              </div>
              {it.notas ? (
                <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">
                  {it.notas}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-zelanda-beige-200 pt-3">
          <span className="font-serif text-[14px] text-zelanda-verde-900">
            Total
          </span>
          <span className="font-serif text-[18px] text-zelanda-verde-900">
            {fmtMonto(total)}
          </span>
        </div>
      </section>

      {compra.notas ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
            Notas
          </h2>
          <p className="text-[13px] text-zelanda-verde-800">{compra.notas}</p>
        </section>
      ) : null}

      <div className="flex justify-end">
        <form action={borrarCompra}>
          <input type="hidden" name="id" value={String(compra.id)} />
          <button
            type="submit"
            className="rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-3 py-1.5 text-[12px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
          >
            Borrar compra (revierte stock)
          </button>
        </form>
      </div>
    </div>
  );
}
