import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Grid3x3 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Conteos por estado
  const conteos = arboles.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] ?? 0) + 1;
    return acc;
  }, {});
  const estadosOrden = ["SALUDABLE", "CON_NOVEDAD", "MUERTO", "REMOVIDO"];

  return (
    <div className="space-y-5">
      <Link
        href={`/jefe/lotes/${lote.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lote {lote.nombre}
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Mapa de árboles
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl text-zelanda-verde-900">
          <Grid3x3 className="h-6 w-6 text-zelanda-verde-600" />
          Lote {lote.nombre}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {arboles.length.toLocaleString("es-CO")} árboles cargados de{" "}
          {lote.total_arboles.toLocaleString("es-CO")}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {estadosOrden.map((est) => (
          <div
            key={est}
            className="rounded-lg border border-zelanda-beige-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded ${COLOR_ESTADO[est]}`}
                aria-hidden
              />
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                {ETIQUETA_ESTADO[est]}
              </span>
            </div>
            <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
              {(conteos[est] ?? 0).toLocaleString("es-CO")}
            </p>
          </div>
        ))}
      </section>

      {arboles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          No hay árboles cargados todavía.
        </p>
      ) : (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-card">
          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))",
            }}
          >
            {arboles.map((a) => (
              <Link
                key={String(a.id)}
                href={`/jefe/lotes/${lote.id}/arbol/${a.numero_placa}`}
                aria-label={`Árbol ${a.numero_placa}: ${ETIQUETA_ESTADO[a.estado]}`}
                title={`Nº ${a.numero_placa} · ${ETIQUETA_ESTADO[a.estado]}`}
                className={`aspect-square rounded-sm transition hover:ring-2 hover:ring-zelanda-verde-700 ${
                  COLOR_ESTADO[a.estado] ?? "bg-zelanda-beige-300"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-zelanda-verde-700/70">
            Tocá un árbol para abrir su ficha completa.
          </p>
        </section>
      )}
    </div>
  );
}
