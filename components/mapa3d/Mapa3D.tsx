'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { centroideDePoligono, COLOR_ESTADO_LOTE, type EstadoLote } from '@/lib/mapa3d';

type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };
type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

export type LoteMapa3D = {
  id: string;
  nombre: string;
  estado: EstadoLote;
  colorCosecha: string;
  kgMes: number;
  trabajandoHoy: number;
  geojson: GeoJsonPolygon;
};

export type ModoMapa = 'tareas' | 'cosecha' | 'equipo' | 'historia' | 'clima';

const CENTRO_QUINDIO: [number, number] = [-75.681, 4.535];

// Última posición de cámara del usuario, para no re-encuadrar la finca
// cada vez que vuelve al centro de control.
const CLAVE_CAMARA = 'zelanda_mapa3d_camara';

type CamaraGuardada = {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
};

function leerCamaraGuardada(): CamaraGuardada | null {
  try {
    const raw = localStorage.getItem(CLAVE_CAMARA);
    if (!raw) return null;
    const c = JSON.parse(raw) as CamaraGuardada;
    if (
      !Array.isArray(c.center) ||
      c.center.length !== 2 ||
      typeof c.center[0] !== 'number' ||
      typeof c.center[1] !== 'number' ||
      typeof c.zoom !== 'number'
    ) {
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

function guardarCamara(map: maplibregl.Map) {
  try {
    const centro = map.getCenter();
    const camara: CamaraGuardada = {
      center: [centro.lng, centro.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    };
    localStorage.setItem(CLAVE_CAMARA, JSON.stringify(camara));
  } catch {
    // localStorage lleno o bloqueado: no es crítico
  }
}

const ESTILO_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satelite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri',
    },
    terreno: {
      type: 'raster-dem',
      tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    },
  },
  layers: [{ id: 'satelite', type: 'raster', source: 'satelite' }],
};

function pinturaFill(modo: ModoMapa): maplibregl.ExpressionSpecification | string {
  if (modo === 'cosecha' || modo === 'historia') return ['get', 'colorCosecha'] as never;
  if (modo === 'equipo') return '#5a7d8a';
  if (modo === 'clima') return '#4a708a';
  return [
    'match',
    ['get', 'estado'],
    'vencida',
    COLOR_ESTADO_LOTE.vencida,
    'proxima',
    COLOR_ESTADO_LOTE.proxima,
    COLOR_ESTADO_LOTE.aldia,
  ] as never;
}

export type ManijaMapa3D = {
  volarA: (opts: {
    center: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) => void;
};

type PropsMapa3D = {
  lotes: LoteMapa3D[];
  bordeFinca: GeoJsonPolygon | null;
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[];
  modo: ModoMapa;
  ndvi?: { url: string; bbox: [number, number, number, number] } | null;
  onSeleccionLote: (id: string | null) => void;
  onError: () => void;
};

const Mapa3D = forwardRef<ManijaMapa3D, PropsMapa3D>(function Mapa3D(
  { lotes, bordeFinca, apiarios, modo, ndvi = null, onSeleccionLote, onError },
  ref
) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadoresRef = useRef<maplibregl.Marker[]>([]);
  const cargadoRef = useRef(false);
  const rafRef = useRef<number>(0);
  // Refs para no re-montar el mapa cuando cambian datos/callbacks
  const lotesRef = useRef(lotes);
  const onSeleccionRef = useRef(onSeleccionLote);
  lotesRef.current = lotes;
  onSeleccionRef.current = onSeleccionLote;

  // Montaje único del mapa
  useEffect(() => {
    if (!contRef.current || mapRef.current) return;

    const camaraGuardada = leerCamaraGuardada();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: contRef.current,
        style: ESTILO_BASE,
        center: camaraGuardada?.center ?? CENTRO_QUINDIO,
        zoom: camaraGuardada?.zoom ?? 13.2,
        pitch: camaraGuardada?.pitch ?? 52,
        bearing: camaraGuardada?.bearing ?? -15,
        maxPitch: 72,
        attributionControl: { compact: true },
      });
    } catch {
      onError();
      return;
    }
    mapRef.current = map;
    map.on('error', () => {
      // Errores de baldosas individuales son normales offline; solo caemos
      // si el mapa nunca llegó a cargar.
      if (!cargadoRef.current) onError();
    });

    map.on('load', () => {
      cargadoRef.current = true;
      map.setTerrain({ source: 'terreno', exaggeration: 1.3 });

      map.addSource('lotes', { type: 'geojson', data: featuresDeLotes(lotesRef.current) });
      map.addLayer({
        id: 'lotes-fill',
        type: 'fill',
        source: 'lotes',
        paint: { 'fill-color': pinturaFill(modo) as never, 'fill-opacity': 0.42 },
      });
      map.addLayer({
        id: 'lotes-borde',
        type: 'line',
        source: 'lotes',
        paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'lotes-vencida-pulso',
        type: 'fill',
        source: 'lotes',
        filter: ['==', ['get', 'estado'], 'vencida'],
        paint: { 'fill-color': COLOR_ESTADO_LOTE.vencida, 'fill-opacity': 0.2 },
      });

      if (bordeFinca) {
        map.addSource('borde-finca', {
          type: 'geojson',
          data: { type: 'Feature', geometry: bordeFinca, properties: {} },
        });
        map.addLayer({
          id: 'borde-finca-linea',
          type: 'line',
          source: 'borde-finca',
          paint: {
            'line-color': '#c89045',
            'line-width': 2,
            'line-dasharray': [3, 2],
          },
        });
        // Encuadre inicial solo si el usuario no tiene una posición guardada
        if (!camaraGuardada) {
          const bounds = new maplibregl.LngLatBounds();
          for (const v of bordeFinca.coordinates[0]) {
            bounds.extend(v as [number, number]);
          }
          map.fitBounds(bounds, { padding: 48, pitch: 52, bearing: -15, duration: 0 });
        }
      }

      // Recordar la posición cada vez que el usuario termina de mover el mapa
      map.on('moveend', () => guardarCamara(map));

      map.on('click', 'lotes-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties?.lote_id ?? '');
        const lote = lotesRef.current.find((l) => l.id === id);
        if (lote) {
          map.flyTo({
            center: centroideDePoligono(lote.geojson),
            zoom: Math.max(map.getZoom(), 15),
            duration: 1100,
            // Deja espacio para el panel inferior
            offset: [0, -90],
          });
        }
        onSeleccionRef.current(id);
      });
      map.on('click', (e) => {
        const fs = map.queryRenderedFeatures(e.point, { layers: ['lotes-fill'] });
        if (fs.length === 0) onSeleccionRef.current(null);
      });
      map.on('mouseenter', 'lotes-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'lotes-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      // Pulso sutil en lotes vencidos
      const animar = (t: number) => {
        const op = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t / 600));
        if (map.getLayer('lotes-vencida-pulso')) {
          map.setPaintProperty('lotes-vencida-pulso', 'fill-opacity', op);
        }
        rafRef.current = requestAnimationFrame(animar);
      };
      rafRef.current = requestAnimationFrame(animar);

      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
        }),
        'bottom-right'
      );
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      crearMarcadores(map, lotesRef.current, apiarios, marcadoresRef, modo, (id) =>
        onSeleccionRef.current(id)
      );
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const m of marcadoresRef.current) m.remove();
      marcadoresRef.current = [];
      map.remove();
      mapRef.current = null;
      cargadoRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de modo o de datos: refrescar pintura, fuente y marcadores
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cargadoRef.current) return;
    const src = map.getSource('lotes') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(featuresDeLotes(lotes));
    if (map.getLayer('lotes-fill')) {
      map.setPaintProperty('lotes-fill', 'fill-color', pinturaFill(modo) as never);
    }
    crearMarcadores(map, lotes, apiarios, marcadoresRef, modo, (id) => onSeleccionRef.current(id));
  }, [modo, lotes, apiarios]);

  // Capa NDVI (imagen georreferenciada sobre el satélite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cargadoRef.current) return;
    const quitar = () => {
      if (map.getLayer('ndvi-capa')) map.removeLayer('ndvi-capa');
      if (map.getSource('ndvi')) map.removeSource('ndvi');
    };
    if (!ndvi) {
      quitar();
      return;
    }
    quitar();
    const [w, s, e, n] = ndvi.bbox;
    map.addSource('ndvi', {
      type: 'image',
      url: ndvi.url,
      coordinates: [
        [w, n],
        [e, n],
        [e, s],
        [w, s],
      ],
    });
    // Debajo de los polígonos para no tapar la interacción con los lotes
    map.addLayer(
      { id: 'ndvi-capa', type: 'raster', source: 'ndvi', paint: { 'raster-opacity': 0.7 } },
      'lotes-fill'
    );
    return quitar;
  }, [ndvi]);

  useImperativeHandle(ref, () => ({
    volarA(opts) {
      const map = mapRef.current;
      if (!map || !cargadoRef.current) return;
      map.flyTo({
        center: opts.center,
        zoom: opts.zoom ?? map.getZoom(),
        bearing: opts.bearing ?? map.getBearing(),
        pitch: opts.pitch ?? map.getPitch(),
        duration: opts.duration ?? 2600,
        essential: true,
      });
    },
  }));

  return <div ref={contRef} className="h-full w-full" />;
});

export default Mapa3D;

function featuresDeLotes(lotes: LoteMapa3D[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lotes.map((l) => ({
      type: 'Feature',
      geometry: l.geojson,
      properties: {
        lote_id: l.id,
        nombre: l.nombre,
        estado: l.estado,
        colorCosecha: l.colorCosecha,
      },
    })),
  };
}

function crearMarcadores(
  map: maplibregl.Map,
  lotes: LoteMapa3D[],
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[],
  ref: { current: maplibregl.Marker[] },
  modo: ModoMapa,
  onSeleccionLote: (id: string) => void
) {
  for (const m of ref.current) m.remove();
  ref.current = [];

  for (const l of lotes) {
    const el = document.createElement('button');
    el.type = 'button';
    el.style.cssText =
      'background:none;border:0;padding:0;cursor:pointer;font-family:Georgia,serif;' +
      'color:#fff;text-shadow:0 0 4px rgba(0,0,0,.85);font-size:12.5px;line-height:1.15;text-align:center;';
    const detalle =
      modo === 'cosecha' || modo === 'historia'
        ? `${Math.round(l.kgMes).toLocaleString('es-CO')} kg`
        : modo === 'equipo'
        ? l.trabajandoHoy > 0
          ? `${l.trabajandoHoy} trabajando`
          : ''
        : '';
    el.innerHTML =
      `<strong>${l.nombre}</strong>` +
      (detalle ? `<br><span style="font-size:10.5px;font-family:system-ui">${detalle}</span>` : '');
    el.addEventListener('click', () => onSeleccionLote(l.id));
    ref.current.push(
      new maplibregl.Marker({ element: el }).setLngLat(centroideDePoligono(l.geojson)).addTo(map)
    );
  }

  for (const a of apiarios) {
    if (!a.geojson) continue;
    const el = document.createElement('div');
    el.style.cssText =
      'width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
      'background:linear-gradient(135deg,#c19658,#86612a);border:2px solid #fbf7f0;' +
      'box-shadow:0 2px 4px rgba(20,44,26,.35);display:flex;align-items:center;justify-content:center;';
    el.innerHTML =
      '<span style="transform:rotate(45deg);color:#fbf7f0;font-size:11px;font-weight:700">A</span>';
    ref.current.push(
      new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(a.geojson.coordinates)
        .addTo(map)
    );
  }
}
