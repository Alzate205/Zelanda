import type { Metadata } from "next";
import Link from "next/link";
import {
  Wrench,
  FlaskConical,
  PackageOpen,
  ChevronLeft,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Card } from "@/components/ui/Card";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata: Metadata = { title: "Bodega" };
export const dynamic = "force-dynamic";

export default async function PaginaPrestamos() {
  const usuario = await requerirUsuario("TRABAJADOR");

  if (usuario.persona_id === null) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="font-serif text-2xl text-zelanda-verde-900">Bodega</h1>
        </header>
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          Tu usuario no tiene persona vinculada. Pedile al jefe que la asigne.
        </p>
      </div>
    );
  }

  const despachos = await prisma.despachos.findMany({
    where: {
      persona_id: BigInt(usuario.persona_id),
      estado: "ABIERTO",
    },
    orderBy: { fecha: "desc" },
    include: {
      despacho_items: {
        include: {
          herramientas: { select: { nombre: true } },
          insumos: { select: { nombre: true, unidad: true } },
        },
      },
      asignacion: {
        select: {
          tipos_tarea: { select: { nombre: true } },
          lotes: { select: { nombre: true } },
          apiarios: { select: { nombre: true } },
        },
      },
    },
  });

  const totalItems = despachos.reduce(
    (acc, d) => acc + d.despacho_items.length,
    0,
  );

  return (
    <div className="space-y-5 pb-12">
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <Eyebrow>Lo que tenés prestado</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bodega
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {despachos.length === 0
            ? "No tenés despachos abiertos."
            : `${despachos.length} ${despachos.length === 1 ? "despacho" : "despachos"} · ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
        </p>
      </header>

      {despachos.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-12 text-center">
          <PackageOpen className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-lg text-zelanda-verde-900">
            Sin préstamos activos
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Cuando bodega te despache herramientas o insumos, los vas a ver acá.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {despachos.map((d) => {
            const destino = d.asignacion?.lotes?.nombre
              ? `Lote ${d.asignacion.lotes.nombre}`
              : d.asignacion?.apiarios?.nombre
                ? `Apiario ${d.asignacion.apiarios.nombre}`
                : null;
            return (
              <Card key={String(d.id)} lift className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-zelanda-verde-700">
                      Despacho #{String(d.id)} · {formatearFechaCorta(d.fecha)}
                    </p>
                    {d.asignacion ? (
                      <p className="mt-1 font-serif text-[15px] text-zelanda-verde-900">
                        {d.asignacion.tipos_tarea.nombre}
                        {destino ? (
                          <span className="text-zelanda-verde-700">
                            {" "}
                            · {destino}
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-1 font-serif text-[15px] text-zelanda-verde-900">
                        Sin asignación vinculada
                      </p>
                    )}
                  </div>
                  <Badge estado="vencida">Abierto</Badge>
                </div>

                <ul className="mt-3 flex flex-col gap-1.5 border-t border-zelanda-beige-200 pt-3">
                  {d.despacho_items.map((it) => {
                    const esHerramienta = it.tipo_item === "HERRAMIENTA";
                    const nombre = esHerramienta
                      ? (it.herramientas?.nombre ?? "?")
                      : (it.insumos?.nombre ?? "?");
                    const unidad = esHerramienta
                      ? Number(it.cantidad) === 1
                        ? "unidad"
                        : "unidades"
                      : (it.insumos?.unidad ?? "");
                    return (
                      <li
                        key={String(it.id)}
                        className="flex items-center gap-2.5 text-[13px]"
                      >
                        <span
                          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${
                            esHerramienta
                              ? "bg-zelanda-verde-50 text-zelanda-verde-700"
                              : "bg-zelanda-ocre-50 text-zelanda-ocre-700"
                          }`}
                        >
                          {esHerramienta ? (
                            <Wrench className="h-4 w-4" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                        </span>
                        <span className="flex-1 truncate text-zelanda-verde-900">
                          {nombre}
                        </span>
                        <span className="text-[11.5px] text-zelanda-verde-700">
                          {Number(it.cantidad)} {unidad}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {d.notas ? (
                  <p className="mt-3 rounded-[10px] bg-zelanda-beige-100 px-3 py-2 text-xs text-zelanda-verde-800">
                    {d.notas}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </ul>
      )}

      {despachos.length > 0 ? (
        <p className="text-center text-xs text-zelanda-verde-700/70">
          El cierre del despacho lo hace bodega cuando devolvés las herramientas.
        </p>
      ) : null}
    </div>
  );
}
