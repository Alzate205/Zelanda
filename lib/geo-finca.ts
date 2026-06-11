import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { parseGeoJsonSafe } from '@/lib/geo';

type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };
type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

export type GeoFinca = {
  lotesParaMapa: {
    id: string;
    nombre: string;
    total_arboles: number;
    hectareas: number | null;
    geojson: GeoJsonPolygon | null;
  }[];
  apiariosParaMapa: {
    id: string;
    nombre: string;
    total_colmenas: number;
    ubicacion_descripcion: string | null;
    geojson: GeoJsonPoint | null;
  }[];
  instParaMapa: {
    id: string;
    nombre: string;
    tipo: 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO';
    geojson: GeoJsonPoint | null;
  }[];
  bordeFinca: GeoJsonPolygon | null;
};

// unstable_cache serializa a JSON, así que los bigint de Prisma se
// convierten a string acá adentro, antes de salir de la función cacheada.
const obtenerGeoFincaUncached = async (): Promise<GeoFinca> => {
  const [lotesRaw, apiariosRaw, instalacionesRaw, fincaRaw] = await Promise.all([
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
        ubicacion_descripcion: string | null;
        punto_geojson: string | null;
      }[]
    >`
        SELECT id, nombre, total_colmenas, ubicacion_descripcion,
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
  ]);

  return {
    lotesParaMapa: lotesRaw.map((l) => ({
      id: l.id.toString(),
      nombre: l.nombre,
      total_arboles: l.total_arboles,
      hectareas: l.hectareas !== null ? Number(l.hectareas) : null,
      geojson: parseGeoJsonSafe<GeoJsonPolygon>(l.poligono_geojson),
    })),
    apiariosParaMapa: apiariosRaw.map((a) => ({
      id: a.id.toString(),
      nombre: a.nombre,
      total_colmenas: a.total_colmenas,
      ubicacion_descripcion: a.ubicacion_descripcion,
      geojson: parseGeoJsonSafe<GeoJsonPoint>(a.punto_geojson),
    })),
    instParaMapa: instalacionesRaw.map((i) => ({
      id: i.id.toString(),
      nombre: i.nombre,
      tipo: i.tipo as 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO',
      geojson: parseGeoJsonSafe<GeoJsonPoint>(i.punto_geojson),
    })),
    bordeFinca: parseGeoJsonSafe<GeoJsonPolygon>(fincaRaw[0]?.poligono_geojson ?? null),
  };
};

/** Geometrías de la finca, cacheadas 1 h. Invalidar con revalidateTag('geo-finca'). */
export const obtenerGeoFinca = unstable_cache(obtenerGeoFincaUncached, ['geo-finca'], {
  revalidate: 3600,
  tags: ['geo-finca'],
});
