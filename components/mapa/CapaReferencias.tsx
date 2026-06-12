'use client';

import { GeoJSON, Marker } from 'react-leaflet';
import L from 'leaflet';
import { colorDeLote } from '@/lib/paleta-lotes';
import type { GeoJsonPolygon, GeoJsonPoint } from '@/lib/geo';

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

// Punto de referencia con su nombre, para orientarse mientras se dibuja.
function iconoRef(nombre: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:translate(-50%,-7px)">
      <div style="width:12px;height:12px;border-radius:9999px;background:#ffffff;border:2px solid rgba(61,92,66,0.6);box-shadow:0 1px 2px rgba(20,44,26,0.25)"></div>
      <div style="font-family:system-ui;font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap">${nombre}</div>
    </div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

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
            color: '#c89045',
            weight: 1.5,
            dashArray: '8,6',
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
          icon={iconoRef(p.nombre)}
          interactive={false}
          opacity={0.85}
        />
      ))}
    </>
  );
}
