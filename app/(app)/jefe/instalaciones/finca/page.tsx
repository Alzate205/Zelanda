import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditorBordeCargador } from "./_editor";
import { cargarReferenciasMapa } from "@/lib/referencias-mapa";

export const metadata = { title: "Borde de la finca" };

export default async function Page() {
  await requerirUsuario("JEFE");
  const [rows, referencias] = await Promise.all([
    prisma.$queryRaw<{ geojson: string | null }[]>`
      SELECT ST_AsGeoJSON(poligono)::text AS geojson FROM finca LIMIT 1
    `,
    cargarReferenciasMapa({ incluirBorde: false }),
  ]);
  const geojson = rows[0]?.geojson ?? null;
  return (
    <div className="space-y-4">
      <Link
        href="/jefe/instalaciones"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Borde
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hacienda La Zelanda
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá cada esquina del borde de la finca. Cuando termines,
          &ldquo;Cerrar y guardar&rdquo;.
        </p>
      </header>
      <EditorBordeCargador geojsonInicial={geojson} referencias={referencias} />
    </div>
  );
}
