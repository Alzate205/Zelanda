'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { centroideDePoligono, COLOR_BORDE_ESTADO, type EstadoLote } from '@/lib/mapa3d';
import { ATRIBUCION_SATELITE, MAXZOOM_SATELITE, URLS_SATELITE_MAPLIBRE } from '@/lib/mapa-tiles';

type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };
type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

export type LoteMapa3D = {
  id: string;
  nombre: string;
  estado: EstadoLote;
  /** Color de identidad del lote: es lo que lo distingue de sus vecinos. */
  color: string;
  colorCosecha: string;
  kgMes: number;
  trabajandoHoy: number;
  geojson: GeoJsonPolygon;
};

export type ModoMapa = 'tareas' | 'clima';

// Vista predeterminada: cámara sobre la Pista (extremo noroeste) mirando
// la finca completa a lo largo, de abajo hacia arriba (rumbo ~150°).
// Calibrada a mano para la finca real; fitBounds con pitch encuadra mal.
const VISTA_FINCA = {
  center: [-75.5166, 4.9377] as [number, number],
  zoom: 15.25,
  pitch: 55,
  bearing: 150,
};

// Última posición de cámara del usuario, para no re-encuadrar la finca
// cada vez que vuelve al centro de control. v2: la v1 podía apuntar a la
// ubicación del seed de prueba, lejos de la finca real.
const CLAVE_CAMARA = 'zelanda_mapa3d_camara_v2';

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
      tiles: URLS_SATELITE_MAPLIBRE,
      tileSize: 256,
      maxzoom: MAXZOOM_SATELITE,
      attribution: ATRIBUCION_SATELITE,
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

/**
 * Relleno del lote: su color de identidad.
 *
 * En modo clima todos van del mismo azul a propósito: ahí lo que se compara es
 * el clima de la finca, no un lote contra otro.
 */
function pinturaFill(modo: ModoMapa): maplibregl.ExpressionSpecification | string {
  if (modo === 'clima') return '#4a708a';
  return ['get', 'color'] as never;
}

/** Borde del lote: el estado de sus tareas. */
function pinturaBorde(modo: ModoMapa): maplibregl.ExpressionSpecification | string {
  if (modo === 'clima') return '#ffffff';
  return [
    'match',
    ['get', 'estado'],
    'vencida',
    COLOR_BORDE_ESTADO.vencida,
    'proxima',
    COLOR_BORDE_ESTADO.proxima,
    COLOR_BORDE_ESTADO.aldia,
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
  encuadrarFinca: () => void;
};

export type InstalacionMapa3D = {
  id: string;
  nombre: string;
  tipo: 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO';
  geojson: GeoJsonPoint | null;
};

type PropsMapa3D = {
  lotes: LoteMapa3D[];
  bordeFinca: GeoJsonPolygon | null;
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[];
  instalaciones?: InstalacionMapa3D[];
  modo: ModoMapa;
  ndvi?: { url: string; bbox: [number, number, number, number] } | null;
  /** Con los lotes apagados solo queda el borde de la finca sobre el satélite. */
  lotesVisibles?: boolean;
  onSeleccionLote: (id: string | null) => void;
  onError: () => void;
};

const Mapa3D = forwardRef<ManijaMapa3D, PropsMapa3D>(function Mapa3D(
  {
    lotes,
    bordeFinca,
    apiarios,
    instalaciones = [],
    modo,
    ndvi = null,
    lotesVisibles = true,
    onSeleccionLote,
    onError,
  },
  ref
) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadoresRef = useRef<maplibregl.Marker[]>([]);
  const cargadoRef = useRef(false);
  // Refs para no re-montar el mapa cuando cambian datos/callbacks
  const lotesRef = useRef(lotes);
  const onSeleccionRef = useRef(onSeleccionLote);
  const lotesVisiblesRef = useRef(lotesVisibles);
  lotesRef.current = lotes;
  onSeleccionRef.current = onSeleccionLote;
  lotesVisiblesRef.current = lotesVisibles;

  // Montaje único del mapa
  useEffect(() => {
    if (!contRef.current || mapRef.current) return;

    const camaraGuardada = leerCamaraGuardada();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: contRef.current,
        style: ESTILO_BASE,
        center: camaraGuardada?.center ?? VISTA_FINCA.center,
        zoom: camaraGuardada?.zoom ?? VISTA_FINCA.zoom,
        pitch: camaraGuardada?.pitch ?? VISTA_FINCA.pitch,
        bearing: camaraGuardada?.bearing ?? VISTA_FINCA.bearing,
        maxPitch: 72,
        attributionControl: { compact: true },
      });
    } catch {
      onError();
      return;
    }
    mapRef.current = map;

    // Muchos Android de gama media tienen pantallas de densidad 3 o 4: sin
    // tope, el mapa renderiza de 9 a 16 veces más píxeles que una pantalla
    // normal, y con el terreno 3D encima la GPU no da abasto. A 2 la diferencia
    // no se nota a simple vista y el trabajo por cuadro cae a menos de la mitad.
    try {
      if (window.devicePixelRatio > 2) map.setPixelRatio(2);
    } catch {
      // Versión de maplibre sin setPixelRatio: se sigue con la densidad nativa.
    }

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
      // El borde lleva el estado, así que se engrosó: a 1.6 px sobre satélite
      // el color no alcanzaba a leerse.
      map.addLayer({
        id: 'lotes-borde',
        type: 'line',
        source: 'lotes',
        paint: { 'line-color': pinturaBorde(modo) as never, 'line-width': 2.4, 'line-opacity': 1 },
      });
      // Acá había un 'lotes-vencida-pulso': una segunda pasada de relleno
      // completa sobre la misma geometría, solo para teñir las vencidas. Ahora
      // eso lo dice el borde, y el mapa se ahorra dibujar todos los polígonos
      // dos veces en cada cuadro.

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
      }

      // Sin posición guardada el mapa ya montó en VISTA_FINCA; nada que hacer.

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

      // Acá vivía el "pulso" de los lotes vencidos: un requestAnimationFrame
      // sin fin que llamaba a setPaintProperty en cada cuadro. Eso obliga a
      // MapLibre a repintar el mapa entero 60 veces por segundo para siempre,
      // aunque nadie lo esté tocando y aunque no haya un solo lote vencido.
      // Con el terreno 3D encima es lo que tenía la pantalla trabada en los
      // Android de gama media y comiéndose la batería. El estado vencido ahora
      // se ve en el color del borde, que es fijo y no cuesta nada.

      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
        }),
        'bottom-right'
      );
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      // Estado inicial del interruptor de lotes: las capas acaban de nacer
      // visibles, así que si el usuario las dejó apagadas hay que apagarlas acá.
      if (!lotesVisiblesRef.current) {
        for (const capa of ['lotes-fill', 'lotes-borde']) {
          if (map.getLayer(capa)) map.setLayoutProperty(capa, 'visibility', 'none');
        }
      }

      crearMarcadores(
        map,
        lotesVisiblesRef.current ? lotesRef.current : [],
        apiarios,
        instalaciones,
        marcadoresRef,
        modo,
        (id) => onSeleccionRef.current(id)
      );
    });

    return () => {
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
    if (map.getLayer('lotes-borde')) {
      map.setPaintProperty('lotes-borde', 'line-color', pinturaBorde(modo) as never);
    }
    crearMarcadores(
      map,
      lotesVisibles ? lotes : [],
      apiarios,
      instalaciones,
      marcadoresRef,
      modo,
      (id) => onSeleccionRef.current(id)
    );
  }, [modo, lotes, apiarios, instalaciones, lotesVisibles]);

  // Mostrar u ocultar los lotes. El borde de la finca queda siempre: es la
  // referencia que dice hasta dónde llega lo propio, y sin ella la foto
  // satelital es monte indistinguible.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cargadoRef.current) return;
    const visibilidad = lotesVisibles ? 'visible' : 'none';
    for (const capa of ['lotes-fill', 'lotes-borde']) {
      if (map.getLayer(capa)) map.setLayoutProperty(capa, 'visibility', visibilidad);
    }
  }, [lotesVisibles]);

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
    encuadrarFinca() {
      const map = mapRef.current;
      if (!map || !cargadoRef.current) return;
      map.flyTo({ ...VISTA_FINCA, duration: 1400, essential: true });
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
        color: l.color,
        colorCosecha: l.colorCosecha,
      },
    })),
  };
}

function crearMarcadores(
  map: maplibregl.Map,
  lotes: LoteMapa3D[],
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[],
  instalaciones: InstalacionMapa3D[],
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
    const detalle = '';
    el.innerHTML =
      `<strong>${l.nombre}</strong>` +
      (detalle ? `<br><span style="font-size:10.5px;font-family:system-ui">${detalle}</span>` : '');
    el.addEventListener('click', () => onSeleccionLote(l.id));
    ref.current.push(
      new maplibregl.Marker({ element: el }).setLngLat(centroideDePoligono(l.geojson)).addTo(map)
    );
  }

  for (const i of instalaciones) {
    if (!i.geojson) continue;
    ref.current.push(
      new maplibregl.Marker({ element: marcadorPunto(i.nombre, '#fbf7f0'), anchor: 'top' })
        .setLngLat(i.geojson.coordinates)
        .addTo(map)
    );
  }

  for (const a of apiarios) {
    if (!a.geojson) continue;
    ref.current.push(
      new maplibregl.Marker({ element: marcadorPunto(a.nombre, '#c89045'), anchor: 'top' })
        .setLngLat(a.geojson.coordinates)
        .addTo(map)
    );
  }
}

// Marker cartográfico sobrio: punto con borde oscuro + etiqueta en
// mayúsculas, al estilo de un plano topográfico.
function marcadorPunto(nombre: string, colorPunto: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;' +
    'transform:translateY(-5px);';
  el.innerHTML =
    `<span style="width:9px;height:9px;border-radius:50%;background:${colorPunto};` +
    `border:2px solid #2e4633;box-shadow:0 1px 3px rgba(0,0,0,.55)"></span>` +
    `<span style="font-family:system-ui;font-size:9.5px;font-weight:600;letter-spacing:.06em;` +
    `text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap">` +
    `${nombre}</span>`;
  return el;
}
