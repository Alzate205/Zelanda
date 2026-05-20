import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditorPoligonoCargador } from "./_editor";
import { cargarReferenciasMapa } from "@/lib/referencias-mapa";

export const metadata = { title: "Polígono del lote" };

export default async function PaginaEditorPoligono({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true },
  });
  if (!lote) notFound();

  const [rows, referencias] = await Promise.all([
    prisma.$queryRaw<{ poligono_geojson: string | null }[]>`
      SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson
      FROM lotes WHERE id = ${BigInt(id)}
    `,
    cargarReferenciasMapa({ excluirLoteId: BigInt(id) }),
  ]);
  const geojson = rows[0]?.poligono_geojson ?? null;

  return (
    <div className="space-y-4">
      <Link
        href={`/jefe/lotes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al lote
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Polígono
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá cada esquina del lote. Cuando termines, &ldquo;Cerrar y
          guardar&rdquo;.
        </p>
      </header>
      <EditorPoligonoCargador
        loteId={lote.id.toString()}
        geojsonInicial={geojson}
        referencias={referencias}
      />
    </div>
  );
}
