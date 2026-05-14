import Link from "next/link";
import { Hexagon } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MapaFincaCargador } from "@/components/mapa/MapaFincaCargador";

export const metadata = { title: "Lotes" };

export default async function PaginaLotes() {
  await requerirUsuario("JEFE");

  const [lotes, apiarios] = await Promise.all([
    prisma.lotes.findMany({
      select: {
        id: true,
        nombre: true,
        total_arboles: true,
        hectareas: true,
      },
      where: { deleted_at: null },
      orderBy: { nombre: "asc" },
    }),
    prisma.apiarios.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        total_colmenas: true,
        ubicacion_descripcion: true,
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const lotesParaMapa = lotes.map((l) => ({
    id: Number(l.id),
    nombre: l.nombre,
    lat: null,
    lng: null,
    total_arboles: l.total_arboles,
  }));

  const apiariosParaMapa = apiarios.map((a) => ({
    id: Number(a.id),
    nombre: a.nombre,
    lat: null,
    lng: null,
    total_colmenas: a.total_colmenas,
  }));

  const haySinCoordenadas =
    lotesParaMapa.every((l) => l.lat === null) &&
    apiariosParaMapa.every((a) => a.lat === null);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Cultivo y apicultura
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Lotes y apiarios
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {lotes.length} lotes · {apiarios.length} apiarios
        </p>
      </header>

      <MapaFincaCargador lotes={lotesParaMapa} apiarios={apiariosParaMapa} />

      {haySinCoordenadas ? (
        <div className="rounded-lg border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-4 py-3 text-sm text-zelanda-verde-800">
          <p className="font-medium">Polígonos pendientes</p>
          <p className="mt-1 text-zelanda-verde-700">
            Aún no se han cargado polígonos de los lotes. Se capturarán en
            campo y se subirán desde el detalle de cada lote.
          </p>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Lotes <span className="text-sm text-zelanda-verde-700">({lotes.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lotes.map((lote) => (
            <Link
              key={Number(lote.id)}
              href={`/jefe/lotes/${lote.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <h3 className="font-serif text-lg text-zelanda-verde-900">
                {lote.nombre}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
                <span>
                  {lote.total_arboles.toLocaleString("es-CO")} árboles
                </span>
                {lote.hectareas ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{Number(lote.hectareas)} ha</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Apiarios <span className="text-sm text-zelanda-verde-700">({apiarios.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apiarios.map((a) => (
            <Link
              key={Number(a.id)}
              href={`/jefe/apiarios/${a.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <div className="flex items-center gap-2">
                <Hexagon className="h-4 w-4 shrink-0 text-zelanda-ocre-500" />
                <h3 className="font-serif text-lg text-zelanda-verde-900">
                  {a.nombre}
                </h3>
              </div>
              <div className="mt-1 text-xs text-zelanda-verde-700">
                {a.total_colmenas} colmenas
                {a.ubicacion_descripcion ? ` · ${a.ubicacion_descripcion}` : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
