import "server-only";
import { prisma } from "@/lib/prisma";
import { parseGeoJsonSafe, type GeoJsonPoint, type GeoJsonPolygon } from "@/lib/geo";

export type LoteRef = {
  id: string;
  nombre: string;
  geojson: GeoJsonPolygon;
};

export type PuntoRef = {
  id: string;
  nombre: string;
  tipo: string;
  geojson: GeoJsonPoint;
};

export type ReferenciasMapa = {
  borde: GeoJsonPolygon | null;
  lotes: LoteRef[];
  apiarios: PuntoRef[];
  instalaciones: PuntoRef[];
};

export async function cargarReferenciasMapa(opts: {
  excluirLoteId?: bigint;
  excluirApiarioId?: bigint;
  excluirInstalacionId?: bigint;
  incluirBorde?: boolean;
} = {}): Promise<ReferenciasMapa> {
  const incluirBorde = opts.incluirBorde !== false;

  const [bordeRows, lotesRaw, apiariosRaw, instalacionesRaw] = await Promise.all([
    incluirBorde
      ? prisma.$queryRaw<{ geojson: string | null }[]>`
          SELECT ST_AsGeoJSON(poligono)::text AS geojson FROM finca LIMIT 1
        `
      : Promise.resolve([]),
    prisma.$queryRaw<
      { id: bigint; nombre: string; geojson: string | null }[]
    >`
      SELECT id, nombre, ST_AsGeoJSON(poligono)::text AS geojson
      FROM lotes
      WHERE deleted_at IS NULL AND poligono IS NOT NULL
    `,
    prisma.$queryRaw<
      { id: bigint; nombre: string; geojson: string | null }[]
    >`
      SELECT id, nombre, ST_AsGeoJSON(coordenadas)::text AS geojson
      FROM apiarios
      WHERE activo = TRUE AND coordenadas IS NOT NULL
    `,
    prisma.$queryRaw<
      { id: bigint; nombre: string; tipo: string; geojson: string | null }[]
    >`
      SELECT id, nombre, tipo::text, ST_AsGeoJSON(coordenadas)::text AS geojson
      FROM instalaciones
      WHERE activo = TRUE AND coordenadas IS NOT NULL
    `,
  ]);

  const borde = incluirBorde
    ? parseGeoJsonSafe<GeoJsonPolygon>(bordeRows[0]?.geojson ?? null)
    : null;

  const lotes: LoteRef[] = lotesRaw
    .filter((l) =>
      opts.excluirLoteId === undefined ? true : l.id !== opts.excluirLoteId,
    )
    .map((l) => ({
      id: l.id.toString(),
      nombre: l.nombre,
      geojson: parseGeoJsonSafe<GeoJsonPolygon>(l.geojson),
    }))
    .filter((l): l is LoteRef => l.geojson !== null);

  const apiarios: PuntoRef[] = apiariosRaw
    .filter((a) =>
      opts.excluirApiarioId === undefined
        ? true
        : a.id !== opts.excluirApiarioId,
    )
    .map((a) => ({
      id: a.id.toString(),
      nombre: a.nombre,
      tipo: "APIARIO",
      geojson: parseGeoJsonSafe<GeoJsonPoint>(a.geojson),
    }))
    .filter((a): a is PuntoRef => a.geojson !== null);

  const instalaciones: PuntoRef[] = instalacionesRaw
    .filter((i) =>
      opts.excluirInstalacionId === undefined
        ? true
        : i.id !== opts.excluirInstalacionId,
    )
    .map((i) => ({
      id: i.id.toString(),
      nombre: i.nombre,
      tipo: i.tipo,
      geojson: parseGeoJsonSafe<GeoJsonPoint>(i.geojson),
    }))
    .filter((i): i is PuntoRef => i.geojson !== null);

  return { borde, lotes, apiarios, instalaciones };
}
