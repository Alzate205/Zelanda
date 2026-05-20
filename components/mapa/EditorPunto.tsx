"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";

type LngLat = [number, number];
const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

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
}: {
  inicial: LngLat | null;
  onChange: (p: LngLat | null) => void;
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
