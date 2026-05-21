import type { Metadata } from "next";
import Link from "next/link";
import {
  Sprout,
  Wrench,
  FlaskConical,
  PackageOpen,
  ChevronLeft,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
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
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Lo que tenés prestado
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl text-zelanda-verde-900">
          <Sprout className="h-6 w-6 text-zelanda-verde-600" />
          Bodega
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {despachos.length === 0
            ? "No tenés despachos abiertos."
            : `${despachos.length} despacho${despachos.length === 1 ? "" : "s"} abierto${despachos.length === 1 ? "" : "s"} · ${totalItems} item${totalItems === 1 ? "" : "s"}`}
        </p>
      </header>

      {despachos.length === 0 ? (
        <section className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-12 text-center">
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
              <li
                key={String(d.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zelanda-verde-700">
                      Despacho #{String(d.id)} · {formatearFechaCorta(d.fecha)}
                    </p>
                    {d.asignacion ? (
                      <p className="mt-1 text-sm font-medium text-zelanda-verde-900">
                        {d.asignacion.tipos_tarea.nombre}
                        {destino ? (
                          <span className="text-zelanda-verde-700"> · {destino}</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-zelanda-verde-900">
                        Sin asignación vinculada
                      </p>
                    )}
                  </div>
                  <BadgeBase tono="alerta">Abierto</BadgeBase>
                </div>

                <ul className="mt-3 space-y-2">
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
                        className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm"
                      >
                        {esHerramienta ? (
                          <Wrench className="h-4 w-4 shrink-0 text-zelanda-verde-700" />
                        ) : (
                          <FlaskConical className="h-4 w-4 shrink-0 text-zelanda-ocre-600" />
                        )}
                        <span className="flex-1 truncate text-zelanda-verde-900">
                          {nombre}
                        </span>
                        <span className="text-zelanda-verde-700">
                          {Number(it.cantidad)} {unidad}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {d.notas ? (
                  <p className="mt-3 rounded-md bg-zelanda-beige-100 px-3 py-2 text-xs text-zelanda-verde-800">
                    {d.notas}
                  </p>
                ) : null}
              </li>
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
