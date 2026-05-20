export type LngLat = [number, number];

export function arrayAWktPolygon(puntos: LngLat[]): string {
  if (puntos.length < 3) throw new Error("Mínimo 3 puntos");
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const cerrados =
    primero[0] === ultimo[0] && primero[1] === ultimo[1]
      ? puntos
      : [...puntos, primero];
  const coords = cerrados.map(([lng, lat]) => `${lng} ${lat}`).join(",");
  return `POLYGON((${coords}))`;
}

export function puntoAWkt(lng: number, lat: number): string {
  return `POINT(${lng} ${lat})`;
}

export type GeoJsonPoint = { type: "Point"; coordinates: LngLat };
export type GeoJsonPolygon = { type: "Polygon"; coordinates: LngLat[][] };

export function parseGeoJsonSafe<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
