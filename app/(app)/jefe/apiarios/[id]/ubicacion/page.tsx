import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioUbicacionApiario } from "./_formulario";

export const metadata = { title: "Ubicación apiario" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const ap = await prisma.apiarios.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true },
  });
  if (!ap) notFound();

  const rows = await prisma.$queryRaw<{ pto: string | null }[]>`
    SELECT ST_AsGeoJSON(coordenadas)::text AS pto FROM apiarios WHERE id = ${BigInt(id)}
  `;
  let inicial: [number, number] | null = null;
  if (rows[0]?.pto) {
    try {
      const obj = JSON.parse(rows[0].pto);
      if (obj?.type === "Point" && Array.isArray(obj.coordinates)) {
        inicial = [obj.coordinates[0], obj.coordinates[1]];
      }
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/jefe/apiarios/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al apiario
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Ubicación
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Apiario {ap.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá en el mapa donde está el apiario.
        </p>
      </header>
      <FormularioUbicacionApiario apiarioId={ap.id.toString()} inicial={inicial} />
    </div>
  );
}
