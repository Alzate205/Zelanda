'use client';

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useActionState, useState, useMemo, useEffect } from 'react';
import { Undo2, Trash2 } from 'lucide-react';
import { guardarBordeFinca, type EstadoEdicion } from '@/lib/acciones-mapa';
import { CapaReferencias } from '@/components/mapa/CapaReferencias';
import type { ReferenciasMapa } from '@/lib/referencias-mapa';

type LngLat = [number, number];

const ESTADO_INICIAL: EstadoEdicion = { error: null };
const CENTRO_FINCA: [number, number] = [4.9409, -75.5165];

function AjustarVistaReferencias({
  lotes,
  vacio,
}: {
  lotes: ReferenciasMapa['lotes'];
  vacio: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!vacio) return;
    if (lotes.length === 0) return;
    try {
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: lotes.map((l) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: l.geojson,
        })),
      };
      const layer = L.geoJSON(featureCollection);
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    } catch {
      /* noop */
    }
  }, [lotes, vacio, map]);
  return null;
}

function Capturador({ onClick }: { onClick: (lng: number, lat: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lng, e.latlng.lat) });
  return null;
}

function parseGeojsonInicial(geojson: string | null): LngLat[] {
  if (!geojson) return [];
  try {
    const obj = JSON.parse(geojson) as {
      type: string;
      coordinates: number[][][];
    };
    if (obj.type !== 'Polygon' || !obj.coordinates[0]) return [];
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

export default function EditorBorde({
  geojsonInicial,
  referencias,
}: {
  geojsonInicial: string | null;
  referencias?: ReferenciasMapa;
}) {
  const iniciales = useMemo(() => parseGeojsonInicial(geojsonInicial), [geojsonInicial]);
  const [vertices, setVertices] = useState<LngLat[]>(iniciales);
  const [estado, formAction, pending] = useActionState(guardarBordeFinca, ESTADO_INICIAL);

  const positions = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
  const previewCierre =
    vertices.length >= 3 ? [positions[positions.length - 1], positions[0]] : null;
  const centro: [number, number] =
    iniciales.length > 0 ? [iniciales[0][1], iniciales[0][0]] : CENTRO_FINCA;

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
        style={{ height: '65vh' }}
      >
        <MapContainer
          center={centro}
          zoom={iniciales.length > 0 ? 15 : 14}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          {referencias && (
            <>
              <AjustarVistaReferencias lotes={referencias.lotes} vacio={iniciales.length === 0} />
              <CapaReferencias
                borde={referencias.borde}
                lotes={referencias.lotes}
                apiarios={referencias.apiarios}
                instalaciones={referencias.instalaciones}
              />
            </>
          )}
          <Capturador onClick={(lng, lat) => setVertices((p) => [...p, [lng, lat] as LngLat])} />
          {positions.length >= 2 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: '#c89045', weight: 3, dashArray: '8,6' }}
            />
          )}
          {previewCierre && (
            <Polyline
              positions={previewCierre}
              pathOptions={{ color: '#c89045', weight: 2, dashArray: '4,4' }}
            />
          )}
          {positions.map((p, idx) => (
            <CircleMarker
              key={`${p[0]}-${p[1]}-${idx}`}
              center={p}
              radius={7}
              pathOptions={{
                color: '#3d5c42',
                fillColor: '#c89045',
                fillOpacity: 1,
                weight: 2,
              }}
            />
          ))}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-zelanda-verde-700">
          Vértices: <strong>{vertices.length}</strong>
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
        <input type="hidden" name="vertices" value={JSON.stringify(vertices)} />
        <button
          type="submit"
          disabled={vertices.length < 3 || pending}
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          {pending ? 'Guardando...' : 'Cerrar y guardar'}
        </button>
      </form>
    </div>
  );
}
