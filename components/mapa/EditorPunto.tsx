"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { CapaReferencias } from "./CapaReferencias";
import type { ReferenciasMapa } from "@/lib/referencias-mapa";

type LngLat = [number, number];
const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

function AjustarVistaReferencias({
  borde,
  inicial,
}: {
  borde: ReferenciasMapa["borde"];
  inicial: LngLat | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (inicial) return; // ya hay un punto, no movemos la vista
    if (borde) {
      try {
        const layer = L.geoJSON(borde);
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch {
        /* noop */
      }
    }
  }, [borde, inicial, map]);
  return null;
}

function Capturador({
  onClick,
}: {
  onClick: (lng: number, lat: number) => void;
}) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lng, e.latlng.lat),
  });
  return null;
}

export default function EditorPunto({
  inicial,
  onChange,
  referencias,
}: {
  inicial: LngLat | null;
  onChange: (p: LngLat | null) => void;
  referencias?: ReferenciasMapa;
}) {
  const [punto, setPunto] = useState<LngLat | null>(inicial);
  const centro: [number, number] = inicial
    ? [inicial[1], inicial[0]]
    : CENTRO_QUINDIO;

  return (
    <div
      className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
      style={{ height: "60vh" }}
    >
      <MapContainer
        center={centro}
        zoom={inicial ? 17 : 14}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        {referencias && (
          <>
            <AjustarVistaReferencias
              borde={referencias.borde}
              inicial={inicial}
            />
            <CapaReferencias
              borde={referencias.borde}
              lotes={referencias.lotes}
              apiarios={referencias.apiarios}
              instalaciones={referencias.instalaciones}
            />
          </>
        )}
        <Capturador
          onClick={(lng, lat) => {
            const p: LngLat = [lng, lat];
            setPunto(p);
            onChange(p);
          }}
        />
        {punto && (
          <CircleMarker
            center={[punto[1], punto[0]]}
            radius={10}
            pathOptions={{
              color: "#3d5c42",
              fillColor: "#c89045",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
