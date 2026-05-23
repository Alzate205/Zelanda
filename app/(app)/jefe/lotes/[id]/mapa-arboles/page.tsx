import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KPI } from "@/components/ui/KPI";

const ETIQUETA_ESTADO: Record<string, string> = {
  SALUDABLE: "Saludable",
  CON_NOVEDAD: "Con novedad",
  MUERTO: "Muerto",
  REMOVIDO: "Removido",
};

const COLOR_ESTADO: Record<string, string> = {
  SALUDABLE: "bg-zelanda-verde-600",
  CON_NOVEDAD: "bg-zelanda-ocre-500",
  MUERTO: "bg-estado-vencida",
  REMOVIDO: "bg-zelanda-beige-300",
};

const COLOR_LEYENDA: Record<string, string> = {
  SALUDABLE: "bg-zelanda-verde-600",
  CON_NOVEDAD: "bg-zelanda-ocre-500",
  MUERTO: "bg-estado-vencida",
  REMOVIDO: "bg-zelanda-beige-400",
};

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loteId = parsearId(id);
  if (!loteId) return { title: "Mapa no encontrado" };
  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { nombre: true },
  });
  return { title: `Mapa de árboles · Lote ${lote?.nombre ?? "?"}` };
}

export default async function MapaArbolesLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const loteId = parsearId(id);
  if (!loteId) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { id: true, nombre: true, total_arboles: true },
  });
  if (!lote) notFound();

  const arboles = await prisma.arboles.findMany({
    where: { lote_id: loteId, deleted_at: null },
    select: { id: true, numero_placa: true, estado: true },
    orderBy: { numero_placa: "asc" },
  });

  const conteos = arboles.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] ?? 0) + 1;
    return acc;
  }, {});
  const estadosOrden = ["SALUDABLE", "CON_NOVEDAD", "MUERTO", "REMOVIDO"];

  const conNovedad = conteos["CON_NOVEDAD"] ?? 0;

  return (
    <div className="-mx-4 -mt-4 space-y-5">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-4 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <Link
            href={`/jefe/lotes/${lote.id}`}
            aria-label="Volver al lote"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Mapa de árboles · Lote
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[22px] font-medium leading-tight">
              {lote.nombre}
            </h1>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-zelanda-beige-100/85">
          <span>
            <strong className="font-serif text-sm text-white">
              {arboles.length.toLocaleString("es-CO")}
            </strong>{" "}
            cargados
          </span>
          <span>
            <strong className="font-serif text-sm text-white">
              {lote.total_arboles.toLocaleString("es-CO")}
            </strong>{" "}
            esperados
          </span>
          {conNovedad > 0 ? (
            <span>
              <strong className="font-serif text-sm text-white">
                {conNovedad}
              </strong>{" "}
              con novedad
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 px-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {estadosOrden.map((est) => (
            <KPI
              key={est}
              etiqueta={ETIQUETA_ESTADO[est]}
              valor={(conteos[est] ?? 0).toLocaleString("es-CO")}
              acento={est === "CON_NOVEDAD" ? "ocre" : "verde"}
            />
          ))}
        </div>

        {arboles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No hay árboles cargados todavía.
          </p>
        ) : (
          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
                Vista por estado
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {estadosOrden.map((est) => (
                  <span
                    key={est}
                    className="flex items-center gap-1 text-[10.5px] text-zelanda-verde-700"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-sm ${COLOR_LEYENDA[est]}`}
                      aria-hidden
                    />
                    {ETIQUETA_ESTADO[est]}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))",
              }}
            >
              {arboles.map((a) => (
                <Link
                  key={String(a.id)}
                  href={`/jefe/lotes/${lote.id}/arbol/${a.numero_placa}`}
                  aria-label={`Árbol ${a.numero_placa}: ${ETIQUETA_ESTADO[a.estado]}`}
                  title={`Nº ${a.numero_placa} · ${ETIQUETA_ESTADO[a.estado]}`}
                  className={`aspect-square rounded-sm transition hover:ring-2 hover:ring-zelanda-verde-700 hover:ring-offset-1 ${
                    COLOR_ESTADO[a.estado] ?? "bg-zelanda-beige-300"
                  }`}
                />
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-zelanda-verde-700">
              Tocá un árbol para abrir su Pokédex completo.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
