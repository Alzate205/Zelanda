"use client";

import { GeoJSON, Marker } from "react-leaflet";
import L from "leaflet";
import { colorDeLote } from "@/lib/paleta-lotes";
import type { GeoJsonPolygon, GeoJsonPoint } from "@/lib/geo";

type LoteRef = {
  id: string;
  nombre: string;
  geojson: GeoJsonPolygon;
};

type PuntoRef = {
  id: string;
  nombre: string;
  tipo: string;
  geojson: GeoJsonPoint;
};

const ICONO_REF = L.divIcon({
  html: `<div style="
    width:14px;height:14px;border-radius:9999px;
    background:#ffffff;border:2px solid rgba(61,92,66,0.45);
    box-shadow:0 1px 2px rgba(20,44,26,0.2);
  "></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function CapaReferencias({
  borde,
  lotes,
  apiarios,
  instalaciones,
}: {
  borde: GeoJsonPolygon | null;
  lotes: LoteRef[];
  apiarios: PuntoRef[];
  instalaciones: PuntoRef[];
}) {
  return (
    <>
      {borde && (
        <GeoJSON
          data={borde}
          pathOptions={{
            color: "#c89045",
            weight: 1.5,
            dashArray: "8,6",
            fillOpacity: 0,
            interactive: false,
          }}
        />
      )}
      {lotes.map((l) => {
        const color = colorDeLote(l.id);
        return (
          <GeoJSON
            key={`ref-lote-${l.id}`}
            data={l.geojson}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.18,
              weight: 1,
              interactive: false,
            }}
          />
        );
      })}
      {[...apiarios, ...instalaciones].map((p) => (
        <Marker
          key={`ref-${p.tipo}-${p.id}`}
          position={[p.geojson.coordinates[1], p.geojson.coordinates[0]]}
          icon={ICONO_REF}
          interactive={false}
          opacity={0.6}
        />
      ))}
    </>
  );
}
