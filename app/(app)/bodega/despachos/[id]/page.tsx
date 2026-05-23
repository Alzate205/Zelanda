import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCierreDespacho } from "./_formulario";

export const metadata = { title: "Despacho" };

export default async function PaginaDetalleDespacho({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const despacho = await prisma.despachos.findUnique({
    where: { id: BigInt(id) },
    include: {
      persona: { select: { nombre_completo: true } },
      asignacion: {
        select: {
          tipos_tarea: { select: { nombre: true } },
          lotes: { select: { nombre: true } },
          apiarios: { select: { nombre: true } },
        },
      },
      despacho_items: {
        include: {
          herramientas: { select: { nombre: true } },
          insumos: { select: { nombre: true, unidad: true } },
        },
      },
    },
  });
  if (!despacho) notFound();

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Despacho #{despacho.id.toString()}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {despacho.persona.nombre_completo}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {fmt(despacho.fecha)}
          {despacho.asignacion && (
            <>
              {" · "}
              {despacho.asignacion.tipos_tarea.nombre} ·{" "}
              {despacho.asignacion.lotes?.nombre ??
                despacho.asignacion.apiarios?.nombre}
            </>
          )}
        </p>
      </header>

      {despacho.estado === "CERRADO" ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <p className="text-sm text-zelanda-verde-700">
            Cerrado el{" "}
            {despacho.fecha_devolucion && fmt(despacho.fecha_devolucion)}
          </p>
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {despacho.despacho_items.map((it) => (
              <li key={it.id.toString()} className="py-2 text-sm">
                {it.tipo_item === "HERRAMIENTA" ? (
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{it.herramientas?.nombre}</span>
                      <span>× {it.cantidad.toString()}</span>
                      <span>·</span>
                      {it.devuelto ? (
                        <span>devuelta</span>
                      ) : (
                        <span className="rounded bg-estado-vencida/10 px-1.5 py-0.5 text-xs font-medium text-estado-vencida">
                          no devuelta
                        </span>
                      )}
                    </p>
                    {it.condicion_devolucion ? (
                      <p className="mt-0.5 text-xs text-zelanda-ocre-700">
                        {it.condicion_devolucion}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p>
                    <span className="font-medium">{it.insumos?.nombre}</span>{" "}
                    despachado {it.cantidad.toString()} {it.insumos?.unidad}, consumido{" "}
                    {it.cantidad_consumida?.toString() ?? "—"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <FormularioCierreDespacho
          despachoId={despacho.id.toString()}
          items={despacho.despacho_items.map((it) => ({
            id: it.id.toString(),
            tipo: it.tipo_item,
            nombre:
              it.tipo_item === "HERRAMIENTA"
                ? it.herramientas?.nombre ?? "?"
                : it.insumos?.nombre ?? "?",
            unidad: it.insumos?.unidad ?? "",
            cantidad: it.cantidad.toString(),
          }))}
        />
      )}
    </div>
  );
}
