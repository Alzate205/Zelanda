"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";

// Centro aproximado del Quindío (entre Armenia y Calarcá).
const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

type PuntoLote = {
  id: number;
  nombre: string;
  lat: number | null;
  lng: number | null;
  total_arboles: number;
};

type PuntoApiario = {
  id: number;
  nombre: string;
  lat: number | null;
  lng: number | null;
  total_colmenas: number;
};

type Props = {
  lotes: PuntoLote[];
  apiarios: PuntoApiario[];
  centro?: [number, number];
  zoom?: number;
  altura?: string;
};

// Marker SVG en línea para apiarios (evita cargar assets externos de leaflet).
const iconoApiario = L.divIcon({
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:linear-gradient(135deg,#c19658,#86612a);
    border:2px solid #fbf7f0;box-shadow:0 2px 4px rgba(20,44,26,0.3);
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
    color:#fbf7f0;font-size:14px;font-weight:700;
  "><span style="transform:rotate(45deg);">A</span></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

export default function MapaFinca({
  lotes,
  apiarios,
  centro = CENTRO_QUINDIO,
  zoom = 13,
  altura = "320px",
}: Props) {
  const lotesConCoord = lotes.filter((l): l is PuntoLote & { lat: number; lng: number } =>
    typeof l.lat === "number" && typeof l.lng === "number",
  );
  const apiariosConCoord = apiarios.filter(
    (a): a is PuntoApiario & { lat: number; lng: number } =>
      typeof a.lat === "number" && typeof a.lng === "number",
  );

  return (
    <div
      className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
      style={{ height: altura }}
    >
      <MapContainer
        center={centro}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, AEX, GeoEye'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {lotesConCoord.map((lote) => (
          <CircleMarker
            key={`lote-${lote.id}`}
            center={[lote.lat, lote.lng]}
            radius={9}
            pathOptions={{
              color: "#fbf7f0",
              weight: 2,
              fillColor: "#3a5c44",
              fillOpacity: 0.92,
            }}
          >
            <Popup>
              <div className="font-sans text-sm">
                <p className="font-medium text-zelanda-verde-900">{lote.nombre}</p>
                <p className="mt-1 text-xs text-zelanda-verde-700">
                  {lote.total_arboles.toLocaleString("es-CO")} árboles
                </p>
                <Link
                  href={`/jefe/lotes/${lote.id}`}
                  className="mt-2 inline-block text-xs font-medium text-zelanda-verde-700 underline"
                >
                  Ver detalle
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {apiariosConCoord.map((ap) => (
          <Marker
            key={`apiario-${ap.id}`}
            position={[ap.lat, ap.lng]}
            icon={iconoApiario}
          >
            <Popup>
              <div className="font-sans text-sm">
                <p className="font-medium text-zelanda-verde-900">Apiario {ap.nombre}</p>
                <p className="mt-1 text-xs text-zelanda-verde-700">
                  {ap.total_colmenas} colmenas
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
