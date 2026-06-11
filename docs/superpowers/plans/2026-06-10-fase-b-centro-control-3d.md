# Fase B — Centro de Control 3D: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El jefe abre la app y aterriza en un mapa 3D a pantalla completa con el relieve real de la finca, lotes en semáforo por estado de tareas, panel inferior al tocar un lote, modos de vista y todo el contenido del dashboard accesible desde un panel deslizable (spec: `docs/superpowers/specs/2026-06-10-zelanda-2-0-design.md`, Fase B).

**Architecture:** `/jefe` (server) entrega snapshot extendido + geometrías cacheadas a `CentroControl` (client, ssr:false). `Mapa3D` encapsula MapLibre GL (satélite Esri + terreno AWS terrarium); los overlays (chips de modo, dock de KPIs, panel de lote, panel central) son componentes hermanos absolutos sobre el mapa. Sin WebGL se cae al `MapaFinca` Leaflet existente. Cero migraciones de BD.

**Tech Stack:** maplibre-gl (nueva dependencia aprobada), Next.js 15, React 19, Tailwind, Prisma (solo queries nuevas en el snapshot).

**Convenciones:** todo en español, sin emojis en UI, mobile-first, commits en español, `npm run ci` verde por tarea.

---

## Mapa de archivos

| Archivo                                       | Acción | Responsabilidad                                                |
| --------------------------------------------- | ------ | -------------------------------------------------------------- |
| `package.json`                                | Modify | + maplibre-gl                                                  |
| `lib/mapa3d.ts`                               | Create | Helpers puros: centroide, colores por estado, rampa de cosecha |
| `lib/mapa3d.test.ts`                          | Create | Tests de los helpers                                           |
| `lib/offline/tipos.ts`                        | Modify | SnapshotJefe + lotes_estado, cosecha_mes_por_lote, equipo_hoy  |
| `lib/jefe/snapshot.ts`                        | Modify | Calcular los 3 campos nuevos                                   |
| `hooks/useSnapshotJefe.ts`                    | Create | Cache offline + refresh del snapshot (extraído del dashboard)  |
| `components/mapa3d/Mapa3D.tsx`                | Create | MapLibre: estilo, terreno, capas, marcadores, flyTo, pulso     |
| `components/mapa3d/ChipsModos.tsx`            | Create | Chips Tareas · Cosecha · Equipo                                |
| `components/mapa3d/DockKPIs.tsx`              | Create | Dock de vidrio con KPIs + botón Panel                          |
| `components/mapa3d/PanelLote.tsx`             | Create | Bottom sheet del lote seleccionado                             |
| `components/mapa3d/PanelCentral.tsx`          | Create | Panel deslizable con alertas + atajos (ex-dashboard)           |
| `components/mapa3d/CentroControl.tsx`         | Create | Orquestador client                                             |
| `components/mapa3d/CentroControlCargador.tsx` | Create | dynamic ssr:false                                              |
| `app/(app)/jefe/page.tsx`                     | Modify | Nueva home del jefe                                            |
| `app/(app)/jefe/_dashboard-cliente.tsx`       | Delete | Reemplazado por PanelCentral                                   |
| `app/(app)/jefe/loading.tsx`                  | Modify | Esqueleto con forma de mapa                                    |
| `app/(app)/jefe/lotes/page.tsx`               | Modify | Quitar mapa Leaflet grande; banner → /jefe                     |

---

### Task 1: Instalar maplibre-gl

**Files:**

- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar**

Run: `npm install maplibre-gl@^5`
Expected: agrega `"maplibre-gl": "^5.x.x"` a dependencies sin errores de peer deps.

- [ ] **Step 2: Verificar que el paquete carga**

Run: `node -e "const v = require('maplibre-gl/package.json').version; console.log('maplibre', v)"`
Expected: imprime la versión instalada.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: agregar maplibre-gl para el centro de control 3D"
```

---

### Task 2: Helpers puros del mapa 3D (TDD)

**Files:**

- Create: `lib/mapa3d.ts`
- Test: `lib/mapa3d.test.ts`

- [ ] **Step 1: Escribir tests que fallan**

Crear `lib/mapa3d.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { centroideDePoligono, rampaCosecha, COLOR_ESTADO_LOTE } from './mapa3d';

describe('centroideDePoligono', () => {
  it('devuelve el centro de un cuadrado', () => {
    const cuadrado = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-75.7, 4.5],
          [-75.6, 4.5],
          [-75.6, 4.6],
          [-75.7, 4.6],
          [-75.7, 4.5], // anillo cerrado: último == primero
        ],
      ],
    };
    const [lng, lat] = centroideDePoligono(cuadrado);
    expect(lng).toBeCloseTo(-75.65, 5);
    expect(lat).toBeCloseTo(4.55, 5);
  });
});

describe('rampaCosecha', () => {
  it('con 0 kg devuelve el color más claro', () => {
    expect(rampaCosecha(0, 1000)).toBe('#efe9dc');
  });
  it('con el máximo devuelve el color más oscuro', () => {
    expect(rampaCosecha(1000, 1000)).toBe('#86612a');
  });
  it('sin máximo (0) no divide por cero', () => {
    expect(rampaCosecha(0, 0)).toBe('#efe9dc');
  });
});

describe('COLOR_ESTADO_LOTE', () => {
  it('tiene los 3 estados del semáforo', () => {
    expect(Object.keys(COLOR_ESTADO_LOTE).sort()).toEqual(['aldia', 'proxima', 'vencida']);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/mapa3d.test.ts`
Expected: FAIL — módulo `./mapa3d` no existe.

- [ ] **Step 3: Implementar `lib/mapa3d.ts`**

```ts
// Helpers puros del centro de control 3D. Sin dependencias de maplibre
// para poder testearlos con vitest.

export const COLOR_ESTADO_LOTE = {
  aldia: '#4e7d57',
  proxima: '#c89045',
  vencida: '#b05642',
} as const;

export type EstadoLote = keyof typeof COLOR_ESTADO_LOTE;

type Poligono = { type: 'Polygon'; coordinates: number[][][] };

/** Centro (promedio de vértices del anillo exterior, sin contar el cierre). */
export function centroideDePoligono(p: Poligono): [number, number] {
  const anillo = p.coordinates[0];
  const n = anillo.length;
  const cerrado = n > 1 && anillo[0][0] === anillo[n - 1][0] && anillo[0][1] === anillo[n - 1][1];
  const vertices = cerrado ? anillo.slice(0, -1) : anillo;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of vertices) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / vertices.length, sumLat / vertices.length];
}

const RAMPA: Array<[number, [number, number, number]]> = [
  [0, [0xef, 0xe9, 0xdc]],
  [0.5, [0xc1, 0x96, 0x58]],
  [1, [0x86, 0x61, 0x2a]],
];

/** Color para el modo cosecha: interpola beige → ocre → café según kg/maxKg. */
export function rampaCosecha(kg: number, maxKg: number): string {
  const t = maxKg <= 0 ? 0 : Math.min(1, Math.max(0, kg / maxKg));
  let i = 0;
  while (i < RAMPA.length - 2 && t > RAMPA[i + 1][0]) i++;
  const [t0, c0] = RAMPA[i];
  const [t1, c1] = RAMPA[i + 1];
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  const rgb = c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run lib/mapa3d.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/mapa3d.ts lib/mapa3d.test.ts
git commit -m "feat: helpers puros del mapa 3D (centroide, semáforo, rampa de cosecha)"
```

---

### Task 3: Extender el snapshot del jefe

**Files:**

- Modify: `lib/offline/tipos.ts` (después de `RecordatorioResumen`, ~línea 171)
- Modify: `lib/jefe/snapshot.ts`

- [ ] **Step 1: Agregar tipos**

En `lib/offline/tipos.ts`, antes de `export type SnapshotJefe`:

```ts
export type LoteEstadoResumen = {
  lote_id: string;
  estado: 'aldia' | 'proxima' | 'vencida';
};

export type CosechaLoteMes = { lote_id: string; kg: number };

export type AsignacionHoyResumen = {
  persona_id: string;
  persona_nombre: string;
  lote_id: string | null;
  lote_nombre: string | null;
  tarea_nombre: string;
};
```

Y dentro de `SnapshotJefe`, después de `personas: PersonaCacheada[];` (opcionales para no romper snapshots viejos cacheados en IndexedDB):

```ts
  lotes_estado?: LoteEstadoResumen[];
  cosecha_mes_por_lote?: CosechaLoteMes[];
  equipo_hoy?: AsignacionHoyResumen[];
```

- [ ] **Step 2: Calcularlos en `lib/jefe/snapshot.ts`**

1. Al `Promise.all` grande (el de `novedadesPendientesRaw, stockBajoRows, ...`) agregar al final dos queries:

```ts
    prisma.cosechas.groupBy({
      by: ['lote_id'],
      where: { fecha: { gte: inicioMes } },
      _sum: { peso_kg: true },
    }),
    prisma.asignaciones.findMany({
      where: { estado: { in: ['PENDIENTE', 'EN_CURSO'] } },
      select: {
        lote_id: true,
        persona: { select: { id: true, nombre_completo: true } },
        tipos_tarea: { select: { nombre: true } },
        lotes: { select: { nombre: true } },
      },
    }),
```

y los nombres correspondientes en el destructuring: `cosechaPorLoteRaw, equipoHoyRaw`.

2. Después del cálculo de `lotesPorEstado` (el bucle que cuenta `lotesAldia/lotesProxima/lotesVencida`), agregar:

```ts
const lotes_estado = Array.from(lotesPorEstado.entries()).map(([lote_id, estado]) => ({
  lote_id,
  estado,
}));

const cosecha_mes_por_lote = cosechaPorLoteRaw.map((c) => ({
  lote_id: String(c.lote_id),
  kg: Number(c._sum.peso_kg ?? 0),
}));

const equipo_hoy = equipoHoyRaw.map((a) => ({
  persona_id: String(a.persona.id),
  persona_nombre: a.persona.nombre_completo,
  lote_id: a.lote_id !== null ? String(a.lote_id) : null,
  lote_nombre: a.lotes?.nombre ?? null,
  tarea_nombre: a.tipos_tarea.nombre,
}));
```

3. En el `return` final, después de `personas,`:

```ts
    lotes_estado,
    cosecha_mes_por_lote,
    equipo_hoy,
```

- [ ] **Step 3: Verificar**

Run: `npm run check:types && npm run test && npm run build`
Expected: todo verde (el endpoint `/api/jefe/snapshot` y el dashboard siguen funcionando: los campos son aditivos).

- [ ] **Step 4: Commit**

```bash
git add lib/offline/tipos.ts lib/jefe/snapshot.ts
git commit -m "feat: snapshot del jefe con estado por lote, cosecha por lote y equipo de hoy"
```

---

### Task 4: Hook useSnapshotJefe (extraer lógica offline del dashboard)

**Files:**

- Create: `hooks/useSnapshotJefe.ts`
- Modify: `app/(app)/jefe/_dashboard-cliente.tsx` (usa el hook; se borra en Task 7)

- [ ] **Step 1: Crear el hook**

Crear `hooks/useSnapshotJefe.ts` (es la lógica que hoy vive en el `useEffect` de `_dashboard-cliente.tsx:85-122`, movida tal cual):

```ts
'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { guardarSnapshotJefe, leerSnapshotJefe, tsJefe } from '@/lib/offline/cache';
import type { SnapshotJefe } from '@/lib/offline/tipos';

/**
 * Snapshot del jefe con cache offline (IndexedDB) y refresh en línea.
 * Devuelve el snapshot más fresco disponible y el timestamp del cache.
 */
export function useSnapshotJefe(snapshotInicial: SnapshotJefe): {
  snapshot: SnapshotJefe;
  tsCache: number | null;
} {
  const online = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<SnapshotJefe>(snapshotInicial);
  const [tsCache, setTsCache] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const cacheado = await leerSnapshotJefe();
      if (!cacheado) {
        await guardarSnapshotJefe(snapshotInicial);
        if (!cancelado) {
          setSnapshot(snapshotInicial);
          setTsCache(await tsJefe());
        }
      } else if (!cancelado) {
        setSnapshot(cacheado);
        setTsCache(await tsJefe());
      }

      if (online) {
        try {
          const res = await fetch('/api/jefe/snapshot');
          if (res.ok) {
            const fresco = (await res.json()) as SnapshotJefe;
            await guardarSnapshotJefe(fresco);
            if (!cancelado) {
              setSnapshot(fresco);
              setTsCache(await tsJefe());
            }
          }
        } catch {
          // offline o error transitorio
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [online, snapshotInicial]);

  return { snapshot, tsCache };
}
```

- [ ] **Step 2: Usarlo en el dashboard actual**

En `app/(app)/jefe/_dashboard-cliente.tsx`:

- Borrar los imports de `useOnlineStatus`, `guardarSnapshotJefe, leerSnapshotJefe, tsJefe` y el `useEffect`/`useState` del snapshot (líneas 81-122).
- Agregar `import { useSnapshotJefe } from '@/hooks/useSnapshotJefe';` y al inicio del componente:

```ts
const { snapshot, tsCache } = useSnapshotJefe(snapshotInicial);
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run check:types && npm run lint && npm run build`
Expected: verde.

```bash
git add hooks/useSnapshotJefe.ts "app/(app)/jefe/_dashboard-cliente.tsx"
git commit -m "refactor: extraer useSnapshotJefe del dashboard del jefe"
```

---

### Task 5: Mapa3D (MapLibre con terreno)

**Files:**

- Create: `components/mapa3d/Mapa3D.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';

import { useEffect, useRef } from 'react';
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

export type ModoMapa = 'tareas' | 'cosecha' | 'equipo';

const CENTRO_QUINDIO: [number, number] = [-75.681, 4.535];

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
  if (modo === 'cosecha') return ['get', 'colorCosecha'] as never;
  if (modo === 'equipo') return '#5a7d8a';
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

export function Mapa3D({
  lotes,
  bordeFinca,
  apiarios,
  modo,
  onSeleccionLote,
  onError,
}: {
  lotes: LoteMapa3D[];
  bordeFinca: GeoJsonPolygon | null;
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[];
  modo: ModoMapa;
  onSeleccionLote: (id: string | null) => void;
  onError: () => void;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadoresRef = useRef<maplibregl.Marker[]>([]);
  const cargadoRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Montaje único del mapa
  useEffect(() => {
    if (!contRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: contRef.current,
        style: ESTILO_BASE,
        center: CENTRO_QUINDIO,
        zoom: 13.2,
        pitch: 52,
        bearing: -15,
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

      // Fuente y capas de lotes
      map.addSource('lotes', { type: 'geojson', data: featuresDeLotes(lotes) });
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
      // Capa de pulso para vencidas (encima del fill)
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
        // Encuadre inicial al borde de la finca
        const bounds = new maplibregl.LngLatBounds();
        for (const v of bordeFinca.coordinates[0]) {
          bounds.extend(v as [number, number]);
        }
        map.fitBounds(bounds, { padding: 48, pitch: 52, bearing: -15, duration: 0 });
      }

      // Click en lote: volar y avisar
      map.on('click', 'lotes-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties?.lote_id ?? '');
        const lote = lotes.find((l) => l.id === id);
        if (lote) {
          map.flyTo({
            center: centroideDePoligono(lote.geojson),
            zoom: Math.max(map.getZoom(), 15),
            duration: 1100,
            // Deja espacio para el panel inferior
            offset: [0, -90],
          });
        }
        onSeleccionLote(id);
      });
      map.on('click', (e) => {
        const fs = map.queryRenderedFeatures(e.point, { layers: ['lotes-fill'] });
        if (fs.length === 0) onSeleccionLote(null);
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

      crearMarcadores(map, lotes, apiarios, marcadoresRef, modo, onSeleccionLote);
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
    crearMarcadores(map, lotes, apiarios, marcadoresRef, modo, onSeleccionLote);
  }, [modo, lotes, apiarios, onSeleccionLote]);

  return <div ref={contRef} className="h-full w-full" />;
}

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
      modo === 'cosecha'
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run check:types`
Expected: sin errores (el componente aún no se usa).

- [ ] **Step 3: Commit**

```bash
git add components/mapa3d/Mapa3D.tsx
git commit -m "feat: componente Mapa3D con MapLibre, terreno y capas de lotes"
```

---

### Task 6: Overlays (chips, dock, panel de lote, GPS, panel central)

**Files:**

- Create: `components/mapa3d/ChipsModos.tsx`
- Create: `components/mapa3d/DockKPIs.tsx`
- Create: `components/mapa3d/PanelLote.tsx`
- Create: `components/mapa3d/PanelCentral.tsx`

Nota: el GPS no necesita componente propio — `Mapa3D` agrega el `GeolocateControl` nativo de MapLibre (ver Task 7, Step 1), que hace seguimiento de ubicación con menos código.

Receta de "vidrio" compartida (premium claro): `rounded-2xl border border-white/60 bg-zelanda-beige-50/85 shadow-card backdrop-blur-md`.

- [ ] **Step 1: ChipsModos**

```tsx
'use client';

import type { ModoMapa } from './Mapa3D';

const MODOS: Array<{ id: ModoMapa; etiqueta: string }> = [
  { id: 'tareas', etiqueta: 'Tareas' },
  { id: 'cosecha', etiqueta: 'Cosecha' },
  { id: 'equipo', etiqueta: 'Equipo' },
];

export function ChipsModos({
  modo,
  onCambio,
}: {
  modo: ModoMapa;
  onCambio: (m: ModoMapa) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {MODOS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onCambio(m.id)}
          className={
            m.id === modo
              ? 'rounded-full bg-zelanda-verde-700 px-3.5 py-1.5 text-xs font-semibold text-zelanda-beige-50 shadow-card'
              : 'rounded-full border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-1.5 text-xs font-medium text-zelanda-verde-800 shadow-suave backdrop-blur-md'
          }
        >
          {m.etiqueta}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: DockKPIs**

```tsx
'use client';

import { LayoutGrid } from 'lucide-react';
import type { SnapshotJefe } from '@/lib/offline/tipos';

export function DockKPIs({
  contadores,
  onAbrirPanel,
}: {
  contadores: SnapshotJefe['contadores'];
  onAbrirPanel: () => void;
}) {
  const celdas = [
    { valor: contadores.lotes_aldia, etiqueta: 'Al día', color: 'text-zelanda-verde-700' },
    { valor: contadores.lotes_proxima, etiqueta: 'Próximas', color: 'text-zelanda-ocre-600' },
    { valor: contadores.lotes_vencida, etiqueta: 'Vencidas', color: 'text-estado-vencida' },
    {
      valor: `${Math.round(contadores.cosecha_mes_kg).toLocaleString('es-CO')}`,
      etiqueta: 'kg mes',
      color: 'text-zelanda-verde-900',
    },
  ];
  return (
    <div className="flex items-stretch gap-2 rounded-2xl border border-white/60 bg-zelanda-beige-50/85 p-2.5 shadow-card backdrop-blur-md">
      {celdas.map((c) => (
        <div key={c.etiqueta} className="min-w-0 flex-1 text-center">
          <p className={`m-0 font-serif text-lg leading-tight ${c.color}`}>{c.valor}</p>
          <p className="m-0 text-[9.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
            {c.etiqueta}
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={onAbrirPanel}
        aria-label="Abrir panel del jefe"
        className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-zelanda-verde-700 text-zelanda-beige-50"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="text-[9px] font-semibold uppercase tracking-wide">Panel</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: PanelLote**

```tsx
'use client';

import Link from 'next/link';
import { X, Trees, AlertTriangle, Scale } from 'lucide-react';
import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { GeoFinca } from '@/lib/geo-finca';
import { COLOR_ESTADO_LOTE, type EstadoLote } from '@/lib/mapa3d';

const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  aldia: 'Al día',
  proxima: 'Tarea próxima',
  vencida: 'Tarea vencida',
};

export function PanelLote({
  lote,
  estado,
  kgMes,
  alertas,
  trabajando,
  onCerrar,
}: {
  lote: GeoFinca['lotesParaMapa'][number];
  estado: EstadoLote;
  kgMes: number;
  alertas: SnapshotJefe['vencidas'];
  trabajando: string[];
  onCerrar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLOR_ESTADO_LOTE[estado] }}
              aria-hidden
            />
            <h2 className="m-0 truncate font-serif text-xl text-zelanda-verde-900">
              {lote.nombre}
            </h2>
          </div>
          <p className="m-0 mt-0.5 text-xs text-zelanda-verde-700">
            {ETIQUETA_ESTADO[estado]}
            {lote.hectareas != null ? ` · ${lote.hectareas.toFixed(1)} ha` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar panel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zelanda-verde-700 hover:bg-zelanda-beige-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-zelanda-verde-800">
        <span className="flex items-center gap-1">
          <Trees className="h-3.5 w-3.5" aria-hidden />
          {lote.total_arboles.toLocaleString('es-CO')} árboles
        </span>
        <span className="flex items-center gap-1">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          {Math.round(kgMes).toLocaleString('es-CO')} kg este mes
        </span>
      </div>

      {alertas.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {alertas.slice(0, 3).map((a) => (
            <li
              key={`${a.tipo_id}`}
              className="flex items-center gap-1.5 text-[12.5px] text-zelanda-verde-800"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0"
                style={{
                  color:
                    a.estado === 'proxima' ? COLOR_ESTADO_LOTE.proxima : COLOR_ESTADO_LOTE.vencida,
                }}
                aria-hidden
              />
              <span className="truncate">
                {a.tipo_nombre}
                {a.estado === 'vencida' && a.dias_para_proxima != null
                  ? ` · vencida hace ${Math.abs(a.dias_para_proxima)} d`
                  : a.estado === 'proxima' && a.dias_para_proxima != null
                  ? ` · en ${a.dias_para_proxima} d`
                  : ' · sin historial'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {trabajando.length > 0 ? (
        <p className="m-0 mt-2 text-[12px] text-zelanda-verde-700">Hoy: {trabajando.join(', ')}</p>
      ) : null}

      <div className="mt-3.5 flex gap-2">
        <Link
          href={`/jefe/asignaciones/nueva?lote_id=${lote.id}`}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl bg-zelanda-verde-700 px-3 text-[13.5px] font-semibold text-zelanda-beige-50"
        >
          Asignar tarea
        </Link>
        <Link
          href={`/jefe/lotes/${lote.id}`}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-verde-300 bg-white/70 px-3 text-[13.5px] font-semibold text-zelanda-verde-800"
        >
          Ver lote
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PanelCentral** (el contenido del dashboard actual, sin los KPIs que ya están en el dock)

```tsx
'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
  Map as MapIcon,
  Users,
  Hexagon,
  Bell,
  DollarSign,
  Briefcase,
  CalendarCheck,
  UserMinus,
  Wallet,
  TrendingUp,
  ShoppingCart,
  Truck,
  Settings,
  History,
  Download,
  X,
} from 'lucide-react';
import type { SnapshotJefe, AlertaTareaJefe } from '@/lib/offline/tipos';
import { ETIQUETA_NOVEDAD } from '@/lib/constantes';
import { AlertaItem } from '@/components/shared/AlertaItem';
import { Atajo } from '@/components/shared/Atajo';

function describirActualizacion(ts: number | null): string {
  if (ts === null) return 'Sin sincronizar';
  const diffMs = Date.now() - ts;
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'Actualizado hace un momento';
  if (minutos < 60) return `Actualizado hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Actualizado hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Actualizado hace ${dias} d`;
}

function subtituloAlerta(alerta: AlertaTareaJefe): string {
  if (alerta.estado === 'sin_historial') {
    return `Sin historial · Lote ${alerta.lote_nombre}`;
  }
  if (alerta.estado === 'vencida') {
    const dias = Math.abs(alerta.dias_para_proxima ?? 0);
    return `Vencida hace ${dias} ${dias === 1 ? 'día' : 'días'} · Lote ${alerta.lote_nombre}`;
  }
  const dias = alerta.dias_para_proxima ?? 0;
  if (dias === 0) return `Hoy · Lote ${alerta.lote_nombre}`;
  if (dias === 1) return `Mañana · Lote ${alerta.lote_nombre}`;
  return `En ${dias} días · Lote ${alerta.lote_nombre}`;
}

export function PanelCentral({
  snapshot,
  tsCache,
  onCerrar,
}: {
  snapshot: SnapshotJefe;
  tsCache: number | null;
  onCerrar: () => void;
}) {
  const { vencidas, proximas, novedades_pendientes } = snapshot;
  const recordatorios = snapshot.recordatorios ?? [];

  const alertasOrdenadas: Array<{
    key: string;
    estado: 'vencida' | 'proxima' | 'neutro' | 'aldia';
    icono: typeof AlertTriangle;
    titulo: string;
    sub: string;
    href: string;
  }> = [];
  for (const v of vencidas.slice(0, 4)) {
    alertasOrdenadas.push({
      key: `v_${v.tipo_id}_${v.lote_id}`,
      estado: 'vencida',
      icono: AlertTriangle,
      titulo: `${v.tipo_nombre} — ${v.lote_nombre}`,
      sub: subtituloAlerta(v),
      href: `/jefe/asignaciones/nueva?lote_id=${v.lote_id}&tipo_tarea_id=${v.tipo_id}`,
    });
  }
  for (const p of proximas) {
    if (alertasOrdenadas.length >= 4) break;
    alertasOrdenadas.push({
      key: `p_${p.tipo_id}_${p.lote_id}`,
      estado: 'proxima',
      icono: Clock,
      titulo: `${p.tipo_nombre} — ${p.lote_nombre}`,
      sub: subtituloAlerta(p),
      href: `/jefe/asignaciones/nueva?lote_id=${p.lote_id}&tipo_tarea_id=${p.tipo_id}`,
    });
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col rounded-none bg-zelanda-beige-50/97 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-zelanda-beige-200 px-4 py-3">
        <h2 className="m-0 font-serif text-lg text-zelanda-verde-900">Panel del jefe</h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Volver al mapa"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zelanda-verde-700 hover:bg-zelanda-beige-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 font-serif text-base text-zelanda-verde-900">Alertas recientes</h3>
            <Link
              href="/jefe/alertas"
              className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
            >
              Ver todas
            </Link>
          </div>
          {alertasOrdenadas.length === 0 && novedades_pendientes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
              Todo al día por ahora.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alertasOrdenadas.map((a) => (
                <AlertaItem
                  key={a.key}
                  estado={a.estado}
                  icono={a.icono}
                  titulo={a.titulo}
                  sub={a.sub}
                  href={a.href}
                />
              ))}
              {novedades_pendientes.slice(0, 2).map((n) => (
                <AlertaItem
                  key={`nov_${n.id}`}
                  estado="neutro"
                  icono={AlertCircle}
                  titulo={`${ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo} — Árbol ${n.arbol_numero}`}
                  sub={`Lote ${n.lote_nombre}`}
                  href={`/jefe/novedades/${n.id}`}
                />
              ))}
              {recordatorios
                .filter((r) => r.estado !== 'proximo')
                .slice(0, 3)
                .map((r) => (
                  <AlertaItem
                    key={`rec_${r.id}`}
                    estado={r.estado === 'vencido' ? 'vencida' : 'proxima'}
                    icono={Bell}
                    titulo={r.titulo}
                    sub={
                      r.estado === 'hoy'
                        ? `Hoy · Para ${r.asignado_a_nombre}`
                        : `Vencido · Para ${r.asignado_a_nombre}`
                    }
                    href="/recordatorios"
                  />
                ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base text-zelanda-verde-900">Atajos</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Atajo
              href="/jefe/asignaciones/nueva"
              icono={Plus}
              titulo="Asignar tarea"
              sub="Crear nueva"
            />
            <Atajo href="/jefe/lotes" icono={MapIcon} titulo="Lotes" sub="Lista y apiarios" />
            <Atajo
              href="/jefe/equipo"
              icono={Users}
              titulo="Equipo"
              sub={`${snapshot.personas.length} personas`}
            />
            <Atajo
              href="/recordatorios"
              icono={Bell}
              titulo="Recordatorios"
              sub={
                recordatorios.length > 0
                  ? `${recordatorios.length} ${
                      recordatorios.length === 1 ? 'pendiente' : 'pendientes'
                    }`
                  : 'Notas con fecha'
              }
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base text-zelanda-verde-900">Más</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Atajo
              href="/jefe/tarifas"
              icono={DollarSign}
              titulo="Tarifas"
              sub="Catálogo de pagos"
            />
            <Atajo
              href="/jefe/pagos"
              icono={DollarSign}
              titulo="Pagos"
              sub="Histórico de salidas"
            />
            <Atajo
              href="/jefe/servicios"
              icono={Briefcase}
              titulo="Servicios"
              sub="Contratos puntuales"
            />
            <Atajo
              href="/jefe/jornales"
              icono={CalendarCheck}
              titulo="Jornales"
              sub="Días trabajados"
            />
            <Atajo
              href="/jefe/ausencias"
              icono={UserMinus}
              titulo="Ausencias"
              sub="Faltas y permisos"
            />
            <Atajo href="/jefe/saldos" icono={Wallet} titulo="Saldos" sub="Cuánto se debe" />
            <Atajo
              href="/jefe/ventas"
              icono={TrendingUp}
              titulo="Ventas"
              sub="Ingresos por cliente"
            />
            <Atajo href="/jefe/clientes" icono={Users} titulo="Clientes" sub="Compradores" />
            <Atajo
              href="/jefe/compras"
              icono={ShoppingCart}
              titulo="Compras"
              sub="Costos de insumos"
            />
            <Atajo
              href="/jefe/proveedores"
              icono={Truck}
              titulo="Proveedores"
              sub="A quién compramos"
            />
            <Atajo
              href="/jefe/reportes"
              icono={ChevronRight}
              titulo="Reportes"
              sub="Cosecha y lotes"
            />
            <Atajo href="/jefe/apiarios/1" icono={Hexagon} titulo="Apiarios" sub="Visitas y miel" />
            <Atajo
              href="/jefe/configuracion"
              icono={Settings}
              titulo="Configuración"
              sub="Parámetros de la finca"
            />
            <Atajo
              href="/jefe/movimientos"
              icono={History}
              titulo="Movimientos"
              sub="Quién registró y anuló"
            />
            <Atajo
              href="/jefe/respaldo"
              icono={Download}
              titulo="Respaldo"
              sub="Exportar datos a CSV"
            />
          </div>
        </section>

        <p className="pb-2 pt-1 text-center text-[11px] text-zelanda-verde-700/70">
          {describirActualizacion(tsCache)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos y commit**

Run: `npm run check:types && npm run lint`
Expected: verde (componentes aún sin usar).

```bash
git add components/mapa3d/ChipsModos.tsx components/mapa3d/DockKPIs.tsx components/mapa3d/PanelLote.tsx components/mapa3d/PanelCentral.tsx
git commit -m "feat: overlays del centro de control (chips, dock, panel lote, panel central)"
```

---

### Task 7: CentroControl + nueva home del jefe

**Files:**

- Create: `components/mapa3d/CentroControl.tsx`
- Create: `components/mapa3d/CentroControlCargador.tsx`
- Modify: `app/(app)/jefe/page.tsx`
- Delete: `app/(app)/jefe/_dashboard-cliente.tsx`
- Modify: `app/(app)/jefe/loading.tsx`

- [ ] **Step 1: CentroControl**

Nota sobre el fallback: si el dispositivo no soporta WebGL se renderiza el `MapaFinca` Leaflet existente con los mismos datos (carga diferida para no pagar Leaflet cuando hay WebGL).

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Mapa3D, type LoteMapa3D, type ModoMapa } from './Mapa3D';
import { ChipsModos } from './ChipsModos';
import { DockKPIs } from './DockKPIs';
import { PanelLote } from './PanelLote';
import { PanelCentral } from './PanelCentral';
import { useSnapshotJefe } from '@/hooks/useSnapshotJefe';
import { rampaCosecha, type EstadoLote } from '@/lib/mapa3d';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { GeoFinca } from '@/lib/geo-finca';

const MapaFincaFallback = dynamic(() => import('@/components/mapa/MapaFinca'), {
  ssr: false,
});

function soportaWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

export function CentroControl({
  nombrePila,
  snapshotInicial,
  geo,
}: {
  nombrePila: string;
  snapshotInicial: SnapshotJefe;
  geo: GeoFinca;
}) {
  const { snapshot, tsCache } = useSnapshotJefe(snapshotInicial);
  const [modo, setModo] = useState<ModoMapa>('tareas');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [conWebGL, setConWebGL] = useState<boolean | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | null>(null);

  useEffect(() => {
    setConWebGL(soportaWebGL());
  }, []);

  // El mapa llena el espacio entre el header y la bottom nav.
  useEffect(() => {
    function medir() {
      const el = contRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const nav = document.querySelector('nav');
      const navAltura = nav ? nav.getBoundingClientRect().height : 64;
      setAltura(Math.max(420, window.innerHeight - top - navAltura));
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const estadoPorLote = useMemo(() => {
    const m = new Map<string, EstadoLote>();
    for (const le of snapshot.lotes_estado ?? []) m.set(le.lote_id, le.estado);
    return m;
  }, [snapshot.lotes_estado]);

  const kgPorLote = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of snapshot.cosecha_mes_por_lote ?? []) m.set(c.lote_id, c.kg);
    return m;
  }, [snapshot.cosecha_mes_por_lote]);

  const equipoPorLote = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of snapshot.equipo_hoy ?? []) {
      if (!a.lote_id) continue;
      const lista = m.get(a.lote_id) ?? [];
      lista.push(`${a.persona_nombre.split(' ')[0]} (${a.tarea_nombre.toLowerCase()})`);
      m.set(a.lote_id, lista);
    }
    return m;
  }, [snapshot.equipo_hoy]);

  const lotesMapa: LoteMapa3D[] = useMemo(() => {
    const maxKg = Math.max(0, ...Array.from(kgPorLote.values()));
    return geo.lotesParaMapa
      .filter((l): l is typeof l & { geojson: NonNullable<typeof l.geojson> } => l.geojson !== null)
      .map((l) => ({
        id: l.id,
        nombre: l.nombre,
        estado: estadoPorLote.get(l.id) ?? 'aldia',
        kgMes: kgPorLote.get(l.id) ?? 0,
        colorCosecha: rampaCosecha(kgPorLote.get(l.id) ?? 0, maxKg),
        trabajandoHoy: (equipoPorLote.get(l.id) ?? []).length,
        geojson: l.geojson,
      }));
  }, [geo.lotesParaMapa, estadoPorLote, kgPorLote, equipoPorLote]);

  const loteSel = loteId ? geo.lotesParaMapa.find((l) => l.id === loteId) ?? null : null;
  const alertasDelLote = useMemo(() => {
    if (!loteId) return [];
    return [...snapshot.vencidas, ...snapshot.proximas].filter((a) => a.lote_id === loteId);
  }, [loteId, snapshot.vencidas, snapshot.proximas]);

  const fechaHoy = useMemo(() => {
    const texto = FORMATEADOR_FECHA.format(new Date());
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, []);

  return (
    <div
      ref={contRef}
      className="relative -mx-4 -my-6 overflow-hidden"
      style={{ height: altura ?? '70svh' }}
    >
      {conWebGL === false ? (
        <div className="h-full w-full p-3">
          <MapaFincaFallback
            lotesPoligonos={geo.lotesParaMapa}
            apiariosPuntos={geo.apiariosParaMapa}
            instalacionesPuntos={geo.instParaMapa}
            bordeFinca={geo.bordeFinca}
            altura="100%"
          />
        </div>
      ) : conWebGL === true ? (
        <Mapa3D
          lotes={lotesMapa}
          bordeFinca={geo.bordeFinca}
          apiarios={geo.apiariosParaMapa}
          modo={modo}
          onSeleccionLote={setLoteId}
          onError={() => setConWebGL(false)}
        />
      ) : null}

      {/* Saludo + chips */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto self-start rounded-2xl border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-2 shadow-card backdrop-blur-md">
          <Eyebrow>Centro de control</Eyebrow>
          <p className="m-0 font-serif text-[17px] leading-tight text-zelanda-verde-900">
            Buen día, {nombrePila}
          </p>
          <p className="m-0 text-[10.5px] text-zelanda-verde-700">{fechaHoy}</p>
        </div>
        <div className="pointer-events-auto">
          <ChipsModos modo={modo} onCambio={setModo} />
        </div>
      </div>

      {/* Dock + panel de lote */}
      <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
        {loteSel ? (
          <PanelLote
            lote={loteSel}
            estado={estadoPorLote.get(loteSel.id) ?? 'aldia'}
            kgMes={kgPorLote.get(loteSel.id) ?? 0}
            alertas={alertasDelLote}
            trabajando={equipoPorLote.get(loteSel.id) ?? []}
            onCerrar={() => setLoteId(null)}
          />
        ) : (
          <DockKPIs contadores={snapshot.contadores} onAbrirPanel={() => setPanelAbierto(true)} />
        )}
      </div>

      {panelAbierto ? (
        <PanelCentral
          snapshot={snapshot}
          tsCache={tsCache}
          onCerrar={() => setPanelAbierto(false)}
        />
      ) : null}
    </div>
  );
}
```

Nota: el `BotonGPS` necesita acceso al objeto map de MapLibre. Para mantener las fronteras simples, en este primer corte el GPS va **dentro** de `Mapa3D` como control propio: agregar al final del `map.on('load', ...)` de `Mapa3D.tsx`:

```ts
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserLocation: true,
  }),
  'bottom-right'
);
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
```

El control nativo de MapLibre hace el seguimiento de ubicación. Mover los controles con CSS si tapan el dock (clase global en `app/globals.css`):

```css
.maplibregl-ctrl-bottom-right {
  bottom: 96px;
}
```

- [ ] **Step 2: CentroControlCargador**

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// MapLibre usa window/document: solo cliente.
const CentroControl = dynamic(() => import('./CentroControl').then((m) => m.CentroControl), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70svh] items-center justify-center text-sm text-zelanda-verde-700">
      Cargando centro de control…
    </div>
  ),
});

export function CentroControlCargador(props: ComponentProps<typeof CentroControl>) {
  return <CentroControl {...props} />;
}
```

- [ ] **Step 3: Nueva `/jefe/page.tsx`**

```tsx
import { requerirUsuario } from '@/lib/auth';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { obtenerGeoFinca } from '@/lib/geo-finca';
import { CentroControlCargador } from '@/components/mapa3d/CentroControlCargador';

export const metadata = { title: 'Centro de control' };

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario('JEFE');
  const [snapshot, geo] = await Promise.all([construirSnapshotJefe(), obtenerGeoFinca()]);
  const nombrePila = usuario.nombre_completo.split(' ')[0];

  return <CentroControlCargador nombrePila={nombrePila} snapshotInicial={snapshot} geo={geo} />;
}
```

- [ ] **Step 4: Borrar el dashboard viejo y actualizar el esqueleto**

```bash
git rm "app/(app)/jefe/_dashboard-cliente.tsx"
```

Reemplazar `app/(app)/jefe/loading.tsx`:

```tsx
import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoJefe() {
  return (
    <div className="relative -mx-4 -my-6 h-[70svh]" role="status" aria-label="Cargando mapa">
      <Esqueleto className="h-full w-full rounded-none" />
      <div className="absolute left-3 top-3">
        <Esqueleto className="h-16 w-44" />
      </div>
      <div className="absolute inset-x-3 bottom-3">
        <Esqueleto className="h-16" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run check:types && npm run lint && npm run build`
Expected: verde. Si `app/globals.css` no existe con ese nombre, buscar el CSS global (`Glob app/*.css`) y poner la regla ahí.

Run: `npm run dev` → abrir `http://localhost:3000/jefe` como jefe.
Expected:

1. Mapa 3D con relieve (inclinado), lotes coloreados por semáforo, etiquetas con nombre.
2. Tocar un lote → la cámara vuela + aparece el panel inferior con datos y botones.
3. Chips cambian colores (cosecha = rampa ocre; equipo = azul grisáceo con conteos).
4. Botón "Panel" → se abre el panel central con alertas y atajos; X vuelve al mapa.
5. Controles de zoom/GPS abajo a la derecha, sin tapar el dock.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: centro de control 3D como nueva home del jefe"
```

---

### Task 8: /jefe/lotes sin el mapa grande

**Files:**

- Modify: `app/(app)/jefe/lotes/page.tsx`
- Modify: `app/(app)/jefe/lotes/loading.tsx`

- [ ] **Step 1: Reemplazar el mapa por un banner al centro de control**

En `app/(app)/jefe/lotes/page.tsx`:

- Quitar el import de `MapaFincaCargador` y el bloque `<MapaFincaCargador …/>`.
- Quitar la sección "Leyenda de lotes" completa (los colores por lote ya no aplican: el mapa usa semáforo).
- Quitar el import ya inutilizado de `colorDeLote`.
- En su lugar (donde estaba el mapa), agregar:

```tsx
<Link
  href="/jefe"
  className="flex items-center justify-between rounded-2xl border border-zelanda-verde-300 bg-gradient-to-r from-zelanda-verde-700 to-zelanda-verde-800 px-4 py-3.5 text-zelanda-beige-50 shadow-card"
>
  <span>
    <span className="block font-serif text-base">Abrir el mapa 3D</span>
    <span className="block text-xs text-zelanda-beige-100/80">
      Centro de control con relieve y semáforo de tareas
    </span>
  </span>
  <MapIcon className="h-5 w-5 shrink-0" aria-hidden />
</Link>
```

con `import { Map as MapIcon } from 'lucide-react';` (reemplaza el import de `Hexagon` por `import { Hexagon, Map as MapIcon } from 'lucide-react';`).

- [ ] **Step 2: Ajustar el esqueleto de `/jefe/lotes`**

En `app/(app)/jefe/lotes/loading.tsx`, reemplazar `<Esqueleto className="h-[60vh] rounded-xl" />` por `<Esqueleto className="h-14" />` (el banner es bajo).

- [ ] **Step 3: Verificar y commit**

Run: `npm run lint && npm run build`
Expected: verde.

```bash
git add "app/(app)/jefe/lotes/page.tsx" "app/(app)/jefe/lotes/loading.tsx"
git commit -m "feat: /jefe/lotes como lista con acceso al centro de control"
```

---

### Task 9: Verificación final de la Fase B

**Files:** ninguno.

- [ ] **Step 1: CI completo**

Run: `npm run ci`
Expected: lint + 78 tests + build verdes.

- [ ] **Step 2: Smoke en build de producción**

Run: `npm run start` (en background) y verificar:

1. `GET /login` → 200.
2. `GET /jefe` sin sesión → redirect a `/login?redirigir=/jefe`.
3. El chunk de maplibre NO aparece en el First Load JS de rutas ajenas a `/jefe` (revisar el output del build: `/trabajador` y `/bodega` no deben crecer).

- [ ] **Step 3: Checklist manual (usuario, en celular)**

1. Login jefe → aterriza en el mapa 3D; inclinar/rotar con dos dedos fluido.
2. Tocar lote vencido (rojo, pulsando) → panel con "Asignar tarea" prellenado.
3. Modo Cosecha y modo Equipo cambian colores/etiquetas.
4. Botón Panel → alertas, recordatorios y todos los atajos de siempre.
5. Modo avión + reabrir → mapa con baldosas cacheadas y datos del último sync.
6. Trabajador/bodega/almacén: sin cambios.

- [ ] **Step 4: Push**

```bash
git push origin <rama>
```
