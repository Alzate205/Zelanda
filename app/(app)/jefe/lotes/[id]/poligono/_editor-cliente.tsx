"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useActionState, useState, useMemo } from "react";
import { Undo2, Trash2 } from "lucide-react";
import {
  guardarPoligonoLote,
  quitarPoligonoLote,
  type EstadoEdicion,
} from "./acciones";

type LngLat = [number, number];

const ESTADO_INICIAL: EstadoEdicion = { error: null };
const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

function CapturadorClicks({
  onClick,
}: {
  onClick: (lng: number, lat: number) => void;
}) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lng, e.latlng.lat),
  });
  return null;
}

function parseGeojsonInicial(geojson: string | null): LngLat[] {
  if (!geojson) return [];
  try {
    const obj = JSON.parse(geojson) as {
      type: string;
      coordinates: number[][][];
    };
    if (obj.type !== "Polygon" || !obj.coordinates[0]) return [];
    const anillo = obj.coordinates[0] as LngLat[];
    if (
      anillo.length > 1 &&
      anillo[0][0] === anillo[anillo.length - 1][0] &&
      anillo[0][1] === anillo[anillo.length - 1][1]
    ) {
      return anillo.slice(0, -1);
    }
    return anillo;
  } catch {
    return [];
  }
}

export default function EditorPoligono({
  loteId,
  geojsonInicial,
}: {
  loteId: string;
  geojsonInicial: string | null;
}) {
  const iniciales = useMemo(
    () => parseGeojsonInicial(geojsonInicial),
    [geojsonInicial],
  );
  const [vertices, setVertices] = useState<LngLat[]>(iniciales);
  const [estado, formAction, pending] = useActionState(
    guardarPoligonoLote,
    ESTADO_INICIAL,
  );

  const positions = vertices.map(
    ([lng, lat]) => [lat, lng] as [number, number],
  );
  const previewCierre =
    vertices.length >= 3 ? [positions[positions.length - 1], positions[0]] : null;
  const centro: [number, number] =
    iniciales.length > 0 ? [iniciales[0][1], iniciales[0][0]] : CENTRO_QUINDIO;

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
        style={{ height: "65vh" }}
      >
        <MapContainer
          center={centro}
          zoom={iniciales.length > 0 ? 16 : 14}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <CapturadorClicks
            onClick={(lng, lat) =>
              setVertices((p) => [...p, [lng, lat] as LngLat])
            }
          />
          {positions.length >= 2 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: "#c89045", weight: 3 }}
            />
          )}
          {previewCierre && (
            <Polyline
              positions={previewCierre}
              pathOptions={{ color: "#c89045", weight: 2, dashArray: "4,4" }}
            />
          )}
          {positions.map((p, idx) => (
            <CircleMarker
              key={`${p[0]}-${p[1]}-${idx}`}
              center={p}
              radius={7}
              pathOptions={{
                color: "#3d5c42",
                fillColor: "#c89045",
                fillOpacity: 1,
                weight: 2,
              }}
            />
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-zelanda-verde-700">
          Vértices: <strong>{vertices.length}</strong>
          {vertices.length > 0 && vertices.length < 3 && (
            <span className="ml-1 text-estado-vencida">
              (necesitás al menos 3)
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVertices((p) => p.slice(0, -1))}
            disabled={vertices.length === 0 || pending}
            className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-xs text-zelanda-verde-700 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> Deshacer
          </button>
          <button
            type="button"
            onClick={() => setVertices([])}
            disabled={vertices.length === 0 || pending}
            className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-estado-vencida/40 px-3 py-1.5 text-xs text-estado-vencida disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Limpiar
          </button>
        </div>
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="lote_id" value={loteId} />
        <input type="hidden" name="vertices" value={JSON.stringify(vertices)} />
        <button
          type="submit"
          disabled={vertices.length < 3 || pending}
          className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Cerrar y guardar"}
        </button>
      </form>

      {iniciales.length > 0 && (
        <form action={quitarPoligonoLote}>
          <input type="hidden" name="lote_id" value={loteId} />
          <button
            type="submit"
            className="mt-1 w-full text-center text-xs text-estado-vencida underline"
          >
            Quitar polígono existente
          </button>
        </form>
      )}
    </div>
  );
}
