'use client';

import { MapContainer, TileLayer, GeoJSON, Tooltip, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { colorDeLote } from '@/lib/paleta-lotes';

const CENTRO_FINCA: [number, number] = [4.9409, -75.5165];

type LotePoly = {
  id: string;
  nombre: string;
  hectareas: number | null;
  geojson: GeoJSON.Polygon | null;
};
type ApiarioPto = {
  id: string;
  nombre: string;
  total_colmenas: number;
  geojson: GeoJSON.Point | null;
};
type InstPto = {
  id: string;
  nombre: string;
  tipo: 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO';
  geojson: GeoJSON.Point | null;
};

function divIconHtml(svg: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:30px;height:30px;border-radius:9999px;
      background:#ffffff;border:2px solid #3d5c42;color:#3d5c42;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 4px rgba(20,44,26,0.3);
    ">${svg}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

const ICONO_INST: Record<InstPto['tipo'], L.DivIcon> = {
  CASA: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>`
  ),
  BODEGA: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/><polyline points="14 11 18 7 22 11"/><line x1="18" y1="7" x2="18" y2="17"/></svg>`
  ),
  ALMACEN: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21V12h6v9"/></svg>`
  ),
  OTRO: divIconHtml(`<span style="font-size:14px">·</span>`),
};

const ICONO_APIARIO = L.divIcon({
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:linear-gradient(135deg,#c19658,#86612a);
    border:2px solid #fbf7f0;box-shadow:0 2px 4px rgba(20,44,26,0.3);
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
    color:#fbf7f0;font-size:12px;font-weight:700;
  "><span style="transform:rotate(45deg);">A</span></div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function ControlesMapa({
  borde,
  fallback,
}: {
  borde: GeoJSON.Polygon | null;
  fallback: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    if (borde) {
      const layer = L.geoJSON(borde);
      try {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch {
        map.setView(fallback, 13);
      }
    } else {
      map.setView(fallback, 13);
    }
    const escala = L.control.scale({ imperial: false, position: 'bottomright' });
    escala.addTo(map);
    const ControlNorte = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        div.innerHTML = `<div style="padding:4px 8px;background:white;font-weight:bold;color:#3d5c42;font-size:14px;font-family:Georgia,serif">N&uarr;</div>`;
        return div;
      },
    });
    const norte = new ControlNorte({ position: 'topright' });
    norte.addTo(map);
    return () => {
      escala.remove();
      norte.remove();
    };
  }, [borde, map, fallback]);
  return null;
}

export default function MapaFinca({
  lotesPoligonos,
  apiariosPuntos,
  instalacionesPuntos,
  bordeFinca,
  altura = '60vh',
}: {
  lotesPoligonos: LotePoly[];
  apiariosPuntos: ApiarioPto[];
  instalacionesPuntos: InstPto[];
  bordeFinca: GeoJSON.Polygon | null;
  altura?: string;
}) {
  const router = useRouter();
  const lotesConPoly = lotesPoligonos.filter(
    (l): l is LotePoly & { geojson: GeoJSON.Polygon } => l.geojson !== null
  );
  const apConPto = apiariosPuntos.filter(
    (a): a is ApiarioPto & { geojson: GeoJSON.Point } => a.geojson !== null
  );
  const instConPto = instalacionesPuntos.filter(
    (i): i is InstPto & { geojson: GeoJSON.Point } => i.geojson !== null
  );

  return (
    <div
      className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
      style={{ height: altura }}
    >
      <MapContainer
        center={CENTRO_FINCA}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <ControlesMapa borde={bordeFinca} fallback={CENTRO_FINCA} />

        {bordeFinca && (
          <GeoJSON
            data={bordeFinca}
            pathOptions={{
              color: '#c89045',
              weight: 2,
              dashArray: '8,6',
              fillOpacity: 0,
            }}
          />
        )}

        {lotesConPoly.map((l) => {
          const color = colorDeLote(l.id);
          return (
            <GeoJSON
              key={`lote-${l.id}`}
              data={l.geojson}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: 2,
              }}
              eventHandlers={{
                click: () => router.push(`/jefe/lotes/${l.id}`),
              }}
            >
              <Tooltip
                permanent
                direction="center"
                className="!bg-transparent !border-0 !shadow-none !text-white"
              >
                <div
                  style={{
                    textShadow: '0 0 3px rgba(0,0,0,0.7)',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  <strong>{l.nombre}</strong>
                  {l.hectareas != null && (
                    <div style={{ fontSize: 11 }}>{l.hectareas.toFixed(1)} ha</div>
                  )}
                </div>
              </Tooltip>
            </GeoJSON>
          );
        })}

        {apConPto.map((a) => (
          <Marker
            key={`ap-${a.id}`}
            position={[a.geojson.coordinates[1], a.geojson.coordinates[0]]}
            icon={ICONO_APIARIO}
          >
            <Popup>
              <div className="font-sans text-sm">
                <p className="font-medium text-zelanda-verde-900">Apiario {a.nombre}</p>
                <p className="mt-1 text-xs text-zelanda-verde-700">{a.total_colmenas} colmenas</p>
                <Link
                  href={`/jefe/apiarios/${a.id}`}
                  className="mt-2 inline-block text-xs underline"
                >
                  Ver detalle
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {instConPto.map((i) => (
          <Marker
            key={`inst-${i.id}`}
            position={[i.geojson.coordinates[1], i.geojson.coordinates[0]]}
            icon={ICONO_INST[i.tipo]}
          >
            <Popup>
              <div className="font-sans text-sm">
                <p className="font-medium text-zelanda-verde-900">{i.nombre}</p>
                <p className="mt-1 text-xs text-zelanda-verde-700">{i.tipo}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
