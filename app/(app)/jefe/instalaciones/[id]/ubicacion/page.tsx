import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioUbicacionInstalacion } from "./_formulario";
import { cargarReferenciasMapa } from "@/lib/referencias-mapa";

export const metadata = { title: "Ubicación" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const inst = await prisma.instalaciones.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true, tipo: true },
  });
  if (!inst) notFound();

  const [rows, referencias] = await Promise.all([
    prisma.$queryRaw<{ pto: string | null }[]>`
      SELECT ST_AsGeoJSON(coordenadas)::text AS pto FROM instalaciones WHERE id = ${BigInt(id)}
    `,
    cargarReferenciasMapa({ excluirInstalacionId: BigInt(id) }),
  ]);
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
        href="/jefe/instalaciones"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Ubicación
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {inst.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá en el mapa donde está {inst.nombre.toLowerCase()}. Podés
          reposicionar tocando otra vez.
        </p>
      </header>
      <FormularioUbicacionInstalacion
        instalacionId={inst.id.toString()}
        inicial={inicial}
        referencias={referencias}
      />
    </div>
  );
}
