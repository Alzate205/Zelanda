import Link from "next/link";
import { Hexagon } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MapaFincaCargador } from "@/components/mapa/MapaFincaCargador";
import { parseGeoJsonSafe } from "@/lib/geo";
import { colorDeLote } from "@/lib/paleta-lotes";

export const metadata = { title: "Lotes" };

type GeoJsonPolygon = { type: "Polygon"; coordinates: number[][][] };
type GeoJsonPoint = { type: "Point"; coordinates: [number, number] };

export default async function PaginaLotes() {
  await requerirUsuario("JEFE");

  const [lotesRaw, apiariosRaw, instalacionesRaw, fincaRaw, apListMin, lotesListMin] =
    await Promise.all([
      prisma.$queryRaw<
        {
          id: bigint;
          nombre: string;
          total_arboles: number;
          hectareas: string | null;
          poligono_geojson: string | null;
        }[]
      >`
        SELECT id, nombre, total_arboles, hectareas::text,
               ST_AsGeoJSON(poligono)::text AS poligono_geojson
        FROM lotes
        WHERE deleted_at IS NULL
        ORDER BY nombre
      `,
      prisma.$queryRaw<
        {
          id: bigint;
          nombre: string;
          total_colmenas: number;
          punto_geojson: string | null;
        }[]
      >`
        SELECT id, nombre, total_colmenas,
               ST_AsGeoJSON(coordenadas)::text AS punto_geojson
        FROM apiarios
        WHERE activo = TRUE
        ORDER BY nombre
      `,
      prisma.$queryRaw<
        {
          id: bigint;
          nombre: string;
          tipo: string;
          punto_geojson: string | null;
        }[]
      >`
        SELECT id, nombre, tipo::text,
               ST_AsGeoJSON(coordenadas)::text AS punto_geojson
        FROM instalaciones
        WHERE activo = TRUE
        ORDER BY tipo, nombre
      `,
      prisma.$queryRaw<{ poligono_geojson: string | null }[]>`
        SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson FROM finca LIMIT 1
      `,
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
      prisma.lotes.findMany({
        where: { deleted_at: null },
        select: { id: true, nombre: true, total_arboles: true, hectareas: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  const lotesParaMapa = lotesRaw.map((l) => ({
    id: l.id.toString(),
    nombre: l.nombre,
    hectareas: l.hectareas !== null ? Number(l.hectareas) : null,
    geojson: parseGeoJsonSafe<GeoJsonPolygon>(l.poligono_geojson),
  }));
  const apiariosParaMapa = apiariosRaw.map((a) => ({
    id: a.id.toString(),
    nombre: a.nombre,
    total_colmenas: a.total_colmenas,
    geojson: parseGeoJsonSafe<GeoJsonPoint>(a.punto_geojson),
  }));
  const instParaMapa = instalacionesRaw.map((i) => ({
    id: i.id.toString(),
    nombre: i.nombre,
    tipo: i.tipo as "CASA" | "BODEGA" | "ALMACEN" | "OTRO",
    geojson: parseGeoJsonSafe<GeoJsonPoint>(i.punto_geojson),
  }));
  const bordeFinca = parseGeoJsonSafe<GeoJsonPolygon>(
    fincaRaw[0]?.poligono_geojson ?? null,
  );

  const lotesSinPoligono = lotesParaMapa.filter((l) => l.geojson === null).length;
  const apSinPto = apiariosParaMapa.filter((a) => a.geojson === null).length;
  const instSinPto = instParaMapa.filter((i) => i.geojson === null).length;
  const sinBorde = bordeFinca === null;
  const totalPendiente =
    lotesSinPoligono + apSinPto + instSinPto + (sinBorde ? 1 : 0);

  const partesPendientes: string[] = [];
  if (lotesSinPoligono > 0)
    partesPendientes.push(
      `${lotesSinPoligono} lote${lotesSinPoligono === 1 ? "" : "s"}`,
    );
  if (apSinPto > 0)
    partesPendientes.push(`${apSinPto} apiario${apSinPto === 1 ? "" : "s"}`);
  if (instSinPto > 0)
    partesPendientes.push(
      `${instSinPto} instalación${instSinPto === 1 ? "" : "es"}`,
    );
  if (sinBorde) partesPendientes.push("borde de la finca");

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
          {lotesListMin.length} lotes · {apListMin.length} apiarios
        </p>
      </header>

      {totalPendiente > 0 && (
        <div className="rounded-lg border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-4 py-3 text-sm">
          <p className="font-medium text-zelanda-verde-800">Captura pendiente</p>
          <p className="mt-1 text-zelanda-verde-700">
            Faltan: {partesPendientes.join(", ")}.
          </p>
          <Link
            href="/jefe/instalaciones"
            className="mt-2 inline-block text-xs font-medium text-zelanda-verde-700 underline"
          >
            Ir a captura →
          </Link>
        </div>
      )}

      <MapaFincaCargador
        lotesPoligonos={lotesParaMapa}
        apiariosPuntos={apiariosParaMapa}
        instalacionesPuntos={instParaMapa}
        bordeFinca={bordeFinca}
      />

      {lotesParaMapa.some((l) => l.geojson !== null) && (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Leyenda de lotes
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-zelanda-verde-700 sm:grid-cols-3">
            {lotesParaMapa
              .filter((l) => l.geojson !== null)
              .map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{
                      background: colorDeLote(l.id),
                      opacity: 0.7,
                      border: `1px solid ${colorDeLote(l.id)}`,
                    }}
                  />
                  <span className="truncate">{l.nombre}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Lotes{" "}
          <span className="text-sm text-zelanda-verde-700">
            ({lotesListMin.length})
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lotesListMin.map((lote) => (
            <Link
              key={Number(lote.id)}
              href={`/jefe/lotes/${lote.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <h3 className="font-serif text-lg text-zelanda-verde-900">
                {lote.nombre}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
                <span>{lote.total_arboles.toLocaleString("es-CO")} árboles</span>
                {lote.hectareas ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{Number(lote.hectareas).toFixed(1)} ha</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Apiarios{" "}
          <span className="text-sm text-zelanda-verde-700">
            ({apListMin.length})
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apListMin.map((a) => (
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
