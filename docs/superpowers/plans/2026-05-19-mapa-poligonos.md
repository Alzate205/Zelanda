# Mapa Leaflet + Polígonos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Mapa satelital con polígonos de los 15 lotes, puntos de 2 apiarios + 3 instalaciones, borde de la finca. Editor didáctico para capturar todo.

**Architecture:** PostGIS + Leaflet/react-leaflet (ya instalados). Lectura/escritura de geometría con `$queryRaw`/`$executeRaw` y funciones PostGIS (`ST_AsGeoJSON`, `ST_GeomFromText`, `ST_Area`). Server actions desde rol JEFE.

**Spec:** `docs/superpowers/specs/2026-05-19-mapa-poligonos-design.md`

**Convenciones:** español en todo, sin emojis en UI, mobile-first con `min-h-touch`, BigInt → `.toString()` antes de pasar a cliente, Decimals con `.toString()`.

---

## Task 1: Migración SQL + Prisma sync

**Files:**
- Create: `supabase/migracion-fase-mapa.sql`
- Modify: `prisma/schema.prisma`
- Modify: `esquema.sql`

- [ ] **Step 1: SQL idempotente**

`supabase/migracion-fase-mapa.sql`:
```sql
BEGIN;

DO $$ BEGIN
  CREATE TYPE tipo_instalacion AS ENUM ('CASA','BODEGA','ALMACEN','OTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS instalaciones (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo tipo_instalacion NOT NULL,
  coordenadas GEOGRAPHY(POINT, 4326),
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_instalaciones_coord ON instalaciones USING GIST(coordenadas);

CREATE TABLE IF NOT EXISTS finca (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  poligono GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO finca (nombre) SELECT 'Hacienda La Zelanda'
WHERE NOT EXISTS (SELECT 1 FROM finca);

INSERT INTO instalaciones (nombre, tipo)
SELECT v.nombre, v.tipo::tipo_instalacion FROM (VALUES
  ('Casa principal','CASA'),
  ('Bodega','BODEGA'),
  ('Almacén','ALMACEN')
) v(nombre, tipo)
WHERE NOT EXISTS (SELECT 1 FROM instalaciones WHERE instalaciones.nombre = v.nombre);

ALTER TABLE instalaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instalaciones_select ON instalaciones;
CREATE POLICY instalaciones_select ON instalaciones FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS instalaciones_jefe_write ON instalaciones;
CREATE POLICY instalaciones_jefe_write ON instalaciones FOR ALL
  USING (public.es_jefe()) WITH CHECK (public.es_jefe());

ALTER TABLE finca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finca_select ON finca;
CREATE POLICY finca_select ON finca FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS finca_jefe_write ON finca;
CREATE POLICY finca_jefe_write ON finca FOR ALL
  USING (public.es_jefe()) WITH CHECK (public.es_jefe());

COMMIT;
```

- [ ] **Step 2: Aplicar manual en Supabase SQL Editor**

- [ ] **Step 3: Agregar a `prisma/schema.prisma`**

```prisma
model instalaciones {
  id          BigInt                    @id @default(autoincrement())
  nombre      String
  tipo        TipoInstalacion
  coordenadas Unsupported("geography")?
  notas       String?
  activo      Boolean                   @default(true)
  created_at  DateTime                  @default(now()) @db.Timestamptz(6)

  @@index([coordenadas], map: "idx_instalaciones_coord", type: Gist)
  @@schema("public")
}

model finca {
  id         BigInt                    @id @default(autoincrement())
  nombre     String
  poligono   Unsupported("geography")?
  created_at DateTime                  @default(now()) @db.Timestamptz(6)

  @@schema("public")
}

enum TipoInstalacion {
  CASA
  BODEGA
  ALMACEN
  OTRO

  @@map("tipo_instalacion")
  @@schema("public")
}
```

- [ ] **Step 4: Reflejar en `esquema.sql`** (cerca de apiarios/lotes; copiar el bloque CREATE TABLE).

- [ ] **Step 5: `npx prisma generate && npm run build`**

- [ ] **Step 6: Commit**

```bash
git add supabase/migracion-fase-mapa.sql prisma/schema.prisma esquema.sql
git commit -m "feat(mapa): tablas instalaciones y finca con seeds y RLS"
```

---

## Task 2: Helpers compartidos

**Files:**
- Create: `lib/geo.ts`
- Create: `lib/paleta-lotes.ts`

- [ ] **Step 1: `lib/geo.ts`**

```ts
export type LngLat = [number, number];

export function arrayAWktPolygon(puntos: LngLat[]): string {
  if (puntos.length < 3) throw new Error("Mínimo 3 puntos");
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const cerrados =
    primero[0] === ultimo[0] && primero[1] === ultimo[1]
      ? puntos
      : [...puntos, primero];
  const coords = cerrados.map(([lng, lat]) => `${lng} ${lat}`).join(",");
  return `POLYGON((${coords}))`;
}

export function puntoAWkt(lng: number, lat: number): string {
  return `POINT(${lng} ${lat})`;
}

export type GeoJsonPoint = { type: "Point"; coordinates: LngLat };
export type GeoJsonPolygon = { type: "Polygon"; coordinates: LngLat[][] };

export function parseGeoJsonSafe<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: `lib/paleta-lotes.ts`**

```ts
const PALETA = [
  "#5a8264","#c89045","#7a9d6e","#a87858","#6b8e5a","#d4a866",
  "#8ca984","#b58866","#3d7050","#c0a060","#7c9070","#9c7548",
];

export function colorDeLote(loteId: number | bigint): string {
  const n = Number(loteId);
  return PALETA[Math.abs(n) % PALETA.length];
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/geo.ts lib/paleta-lotes.ts
git commit -m "feat(mapa): helpers geo y paleta de colores de lotes"
```

---

## Task 3: Extender `MapaFinca` con polígonos, borde y instalaciones

**Files:**
- Modify: `components/mapa/MapaFinca.tsx`

Cambiar la firma de Props y el render para soportar:
- `lotesPoligonos`: array de `{ id, nombre, hectareas, geojson }` (en lugar de los CircleMarker actuales).
- `apiariosPuntos`: array de `{ id, nombre, total_colmenas, geojson }`.
- `instalacionesPuntos`: array de `{ id, nombre, tipo, geojson }`.
- `bordeFinca`: `{ geojson: string | null }`.

- [ ] **Step 1: Reescribir el componente**

`components/mapa/MapaFinca.tsx`:
```tsx
"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Tooltip,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect } from "react";
import { colorDeLote } from "@/lib/paleta-lotes";

const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

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
  tipo: "CASA" | "BODEGA" | "ALMACEN" | "OTRO";
  geojson: GeoJSON.Point | null;
};

const ICONO_INST: Record<InstPto["tipo"], L.DivIcon> = {
  CASA: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>`,
  ),
  BODEGA: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/><polyline points="14 11 18 7 22 11"/><line x1="18" y1="7" x2="18" y2="17"/></svg>`,
  ),
  ALMACEN: divIconHtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21V12h6v9"/></svg>`,
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
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function divIconHtml(svg: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:30px;height:30px;border-radius:9999px;
      background:#ffffff;border:2px solid #3d5c42;color:#3d5c42;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 4px rgba(20,44,26,0.3);
    ">${svg}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function AjustarBordes({
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
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    } else {
      map.setView(fallback, 13);
    }
    // Agregar control de escala
    const escala = L.control.scale({ imperial: false, position: "bottomright" });
    escala.addTo(map);
    // Control "N↑"
    const norte = new L.Control({ position: "topright" });
    norte.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar");
      div.innerHTML = `<div style="padding:4px 8px;background:white;font-weight:bold;color:#3d5c42;font-size:14px;font-family:Georgia,serif">N↑</div>`;
      return div;
    };
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
  altura = "60vh",
}: {
  lotesPoligonos: LotePoly[];
  apiariosPuntos: ApiarioPto[];
  instalacionesPuntos: InstPto[];
  bordeFinca: GeoJSON.Polygon | null;
  altura?: string;
}) {
  const lotesConPoly = lotesPoligonos.filter(
    (l): l is LotePoly & { geojson: GeoJSON.Polygon } => l.geojson !== null,
  );
  const apConPto = apiariosPuntos.filter(
    (a): a is ApiarioPto & { geojson: GeoJSON.Point } => a.geojson !== null,
  );
  const instConPto = instalacionesPuntos.filter(
    (i): i is InstPto & { geojson: GeoJSON.Point } => i.geojson !== null,
  );

  return (
    <div
      className="overflow-hidden rounded-xl border border-zelanda-beige-200 shadow-card"
      style={{ height: altura }}
    >
      <MapContainer
        center={CENTRO_QUINDIO}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <AjustarBordes borde={bordeFinca} fallback={CENTRO_QUINDIO} />

        {bordeFinca && (
          <GeoJSON
            data={bordeFinca}
            pathOptions={{
              color: "#c89045",
              weight: 2,
              dashArray: "8,6",
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
                click: () => {
                  window.location.href = `/jefe/lotes/${l.id}`;
                },
              }}
            >
              <Tooltip
                permanent
                direction="center"
                className="!bg-transparent !border-0 !shadow-none !text-white"
              >
                <div style={{ textShadow: "0 0 3px rgba(0,0,0,0.7)", fontFamily: "Georgia, serif" }}>
                  <strong>{l.nombre}</strong>
                  {l.hectareas != null && (
                    <div style={{ fontSize: 11 }}>
                      {l.hectareas.toFixed(1)} ha
                    </div>
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
                <p className="mt-1 text-xs text-zelanda-verde-700">
                  {a.total_colmenas} colmenas
                </p>
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
```

- [ ] **Step 2: Build local**

`npm run build`. Si rompe porque `MapaFincaCargador` pasa props viejas, lo arreglamos en Task 4.

- [ ] **Step 3: Commit (al final del Task 4 conjunto)**

---

## Task 4: Actualizar `/jefe/lotes` (página principal del mapa)

**Files:**
- Modify: `app/(app)/jefe/lotes/page.tsx`
- Modify: `components/mapa/MapaFincaCargador.tsx` (sólo si cambia firma)

- [ ] **Step 1: Reescribir page.tsx**

`app/(app)/jefe/lotes/page.tsx`:
```tsx
import Link from "next/link";
import { Hexagon } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MapaFincaCargador } from "@/components/mapa/MapaFincaCargador";
import { parseGeoJsonSafe } from "@/lib/geo";
import { colorDeLote } from "@/lib/paleta-lotes";

export const metadata = { title: "Lotes" };

type GeoJsonPolygon = { type: "Polygon"; coordinates: number[][][] };
type GeoJsonPoint = { type: "Point"; coordinates: [number, number] };

export default async function PaginaLotes() {
  await requerirUsuario("JEFE");

  const [lotesRaw, apiariosRaw, instalacionesRaw, fincaRaw, apListMin, lotesListMin] =
    await Promise.all([
      prisma.$queryRaw<{
        id: bigint;
        nombre: string;
        total_arboles: number;
        hectareas: string | null;
        poligono_geojson: string | null;
      }[]>`
        SELECT id, nombre, total_arboles, hectareas::text,
               ST_AsGeoJSON(poligono)::text AS poligono_geojson
        FROM lotes
        WHERE deleted_at IS NULL
        ORDER BY nombre
      `,
      prisma.$queryRaw<{
        id: bigint;
        nombre: string;
        total_colmenas: number;
        punto_geojson: string | null;
      }[]>`
        SELECT id, nombre, total_colmenas,
               ST_AsGeoJSON(coordenadas)::text AS punto_geojson
        FROM apiarios
        WHERE activo = TRUE
        ORDER BY nombre
      `,
      prisma.$queryRaw<{
        id: bigint;
        nombre: string;
        tipo: string;
        punto_geojson: string | null;
      }[]>`
        SELECT id, nombre, tipo::text,
               ST_AsGeoJSON(coordenadas)::text AS punto_geojson
        FROM instalaciones
        WHERE activo = TRUE
        ORDER BY tipo, nombre
      `,
      prisma.$queryRaw<{ poligono_geojson: string | null }[]>`
        SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson FROM finca LIMIT 1
      `,
      prisma.apiarios.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, total_colmenas: true, ubicacion_descripcion: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.lotes.findMany({
        where: { deleted_at: null },
        select: { id: true, nombre: true, total_arboles: true, hectareas: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  const lotesParaMapa = lotesRaw.map((l) => ({
    id: l.id.toString(),
    nombre: l.nombre,
    hectareas: l.hectareas !== null ? Number(l.hectareas) : null,
    geojson: parseGeoJsonSafe<GeoJsonPolygon>(l.poligono_geojson),
  }));
  const apiariosParaMapa = apiariosRaw.map((a) => ({
    id: a.id.toString(),
    nombre: a.nombre,
    total_colmenas: a.total_colmenas,
    geojson: parseGeoJsonSafe<GeoJsonPoint>(a.punto_geojson),
  }));
  const instParaMapa = instalacionesRaw.map((i) => ({
    id: i.id.toString(),
    nombre: i.nombre,
    tipo: i.tipo as "CASA" | "BODEGA" | "ALMACEN" | "OTRO",
    geojson: parseGeoJsonSafe<GeoJsonPoint>(i.punto_geojson),
  }));
  const bordeFinca = parseGeoJsonSafe<GeoJsonPolygon>(
    fincaRaw[0]?.poligono_geojson ?? null,
  );

  const lotesSinPoligono = lotesParaMapa.filter((l) => l.geojson === null).length;
  const apSinPto = apiariosParaMapa.filter((a) => a.geojson === null).length;
  const instSinPto = instParaMapa.filter((i) => i.geojson === null).length;
  const sinBorde = bordeFinca === null;
  const totalPendiente =
    lotesSinPoligono + apSinPto + instSinPto + (sinBorde ? 1 : 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Cultivo y apicultura
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Lotes y apiarios
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {lotesListMin.length} lotes · {apListMin.length} apiarios
        </p>
      </header>

      {totalPendiente > 0 && (
        <div className="rounded-lg border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-4 py-3 text-sm">
          <p className="font-medium text-zelanda-verde-800">
            Captura pendiente
          </p>
          <p className="mt-1 text-zelanda-verde-700">
            Faltan: {lotesSinPoligono > 0 && `${lotesSinPoligono} lotes`}
            {lotesSinPoligono > 0 && (apSinPto > 0 || instSinPto > 0 || sinBorde) && ", "}
            {apSinPto > 0 && `${apSinPto} apiarios`}
            {apSinPto > 0 && (instSinPto > 0 || sinBorde) && ", "}
            {instSinPto > 0 && `${instSinPto} instalaciones`}
            {instSinPto > 0 && sinBorde && ", "}
            {sinBorde && "borde de la finca"}.
          </p>
          <Link
            href="/jefe/instalaciones"
            className="mt-2 inline-block text-xs font-medium text-zelanda-verde-700 underline"
          >
            Ir a captura →
          </Link>
        </div>
      )}

      <MapaFincaCargador
        lotesPoligonos={lotesParaMapa}
        apiariosPuntos={apiariosParaMapa}
        instalacionesPuntos={instParaMapa}
        bordeFinca={bordeFinca}
      />

      {lotesParaMapa.some((l) => l.geojson !== null) && (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Leyenda de lotes
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-zelanda-verde-700 sm:grid-cols-3">
            {lotesParaMapa.filter((l) => l.geojson !== null).map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{
                    background: colorDeLote(l.id),
                    opacity: 0.7,
                    border: `1px solid ${colorDeLote(l.id)}`,
                  }}
                />
                <span className="truncate">{l.nombre}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Lotes <span className="text-sm text-zelanda-verde-700">({lotesListMin.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lotesListMin.map((lote) => (
            <Link
              key={Number(lote.id)}
              href={`/jefe/lotes/${lote.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <h3 className="font-serif text-lg text-zelanda-verde-900">
                {lote.nombre}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
                <span>{lote.total_arboles.toLocaleString("es-CO")} árboles</span>
                {lote.hectareas ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{Number(lote.hectareas).toFixed(1)} ha</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Apiarios <span className="text-sm text-zelanda-verde-700">({apListMin.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apListMin.map((a) => (
            <Link
              key={Number(a.id)}
              href={`/jefe/apiarios/${a.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <div className="flex items-center gap-2">
                <Hexagon className="h-4 w-4 shrink-0 text-zelanda-ocre-500" />
                <h3 className="font-serif text-lg text-zelanda-verde-900">
                  {a.nombre}
                </h3>
              </div>
              <div className="mt-1 text-xs text-zelanda-verde-700">
                {a.total_colmenas} colmenas
                {a.ubicacion_descripcion ? ` · ${a.ubicacion_descripcion}` : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Ajustar `MapaFincaCargador`**

El wrapper actual usa `ComponentProps<typeof MapaFinca>` que se infiere automáticamente. Si Task 3 cambió la firma del MapaFinca, este wrapper compila automáticamente. Verificar.

- [ ] **Step 3: Build + commit (Task 3 + 4 juntos)**

```bash
npm run build
git add components/mapa/MapaFinca.tsx "app/(app)/jefe/lotes/page.tsx" components/mapa/MapaFincaCargador.tsx
git commit -m "feat(mapa): render polígonos lotes + instalaciones + borde finca con leyenda"
```

---

## Task 5: Editor de polígono `/jefe/lotes/[id]/poligono`

**Files:**
- Create: `app/(app)/jefe/lotes/[id]/poligono/page.tsx`
- Create: `app/(app)/jefe/lotes/[id]/poligono/_editor.tsx`
- Create: `app/(app)/jefe/lotes/[id]/poligono/acciones.ts`

- [ ] **Step 1: Acción server**

`acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { arrayAWktPolygon, type LngLat } from "@/lib/geo";

export type EstadoEdicion = { error: string | null };

export async function guardarPoligonoLote(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("lote_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Lote inválido." };
  const verticesRaw = String(formData.get("vertices") ?? "[]");
  let vertices: LngLat[];
  try {
    vertices = JSON.parse(verticesRaw);
  } catch {
    return { error: "Formato de vértices inválido." };
  }
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return { error: "El polígono necesita al menos 3 puntos." };
  }
  let wkt: string;
  try {
    wkt = arrayAWktPolygon(vertices);
  } catch (e) {
    return { error: (e as Error).message };
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE lotes
       SET poligono = ST_GeomFromText($1, 4326)::geography,
           hectareas = ST_Area(ST_GeomFromText($1, 4326)::geography) / 10000,
           updated_at = NOW()
       WHERE id = $2`,
      wkt,
      BigInt(idRaw),
    );
  } catch (e) {
    return { error: `No se pudo guardar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/jefe/lotes");
  revalidatePath(`/jefe/lotes/${idRaw}`);
  redirect(`/jefe/lotes/${idRaw}`);
}

export async function quitarPoligonoLote(formData: FormData) {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("lote_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return;
  await prisma.$executeRaw`
    UPDATE lotes SET poligono = NULL, hectareas = NULL, updated_at = NOW()
    WHERE id = ${BigInt(idRaw)}
  `;
  revalidatePath("/jefe/lotes");
  revalidatePath(`/jefe/lotes/${idRaw}`);
}
```

**Nota:** `$executeRawUnsafe` con parámetros posicionales se usa porque la template literal no expande dos veces el mismo parámetro fácilmente; aquí necesitamos `$1` para el WKT en dos lugares. Esto es safe: $1 viene del JSON parseado y validado por `arrayAWktPolygon` que sólo acepta números.

- [ ] **Step 2: Página server**

`page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditorPoligonoCargador } from "./_editor";

export const metadata = { title: "Polígono del lote" };

export default async function PaginaEditorPoligono({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true },
  });
  if (!lote) notFound();

  const rows = await prisma.$queryRaw<{ poligono_geojson: string | null }[]>`
    SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson
    FROM lotes WHERE id = ${BigInt(id)}
  `;
  const geojson = rows[0]?.poligono_geojson ?? null;

  return (
    <div className="space-y-4">
      <Link
        href={`/jefe/lotes/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al lote
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Polígono
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá cada esquina del lote. Cuando termines, "Cerrar y guardar".
        </p>
      </header>
      <EditorPoligonoCargador
        loteId={lote.id.toString()}
        geojsonInicial={geojson}
      />
    </div>
  );
}
```

- [ ] **Step 3: Editor cliente**

`_editor.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";

const EditorPoligono = dynamic(() => import("./_editor-cliente"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

export function EditorPoligonoCargador(props: {
  loteId: string;
  geojsonInicial: string | null;
}) {
  return <EditorPoligono {...props} />;
}
```

Y `_editor-cliente.tsx`:
```tsx
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
import { guardarPoligonoLote, quitarPoligonoLote, type EstadoEdicion } from "./acciones";

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
    // Quitar el último punto que es duplicado del primero (cierre)
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
  const iniciales = useMemo(() => parseGeojsonInicial(geojsonInicial), [geojsonInicial]);
  const [vertices, setVertices] = useState<LngLat[]>(iniciales);
  const [estado, formAction, pending] = useActionState(
    guardarPoligonoLote,
    ESTADO_INICIAL,
  );

  const agregarVertice = (lng: number, lat: number) =>
    setVertices((p) => [...p, [lng, lat]]);
  const deshacer = () => setVertices((p) => p.slice(0, -1));
  const limpiar = () => setVertices([]);

  const centro: [number, number] =
    iniciales.length > 0 ? [iniciales[0][1], iniciales[0][0]] : CENTRO_QUINDIO;

  // Convertir LngLat → [lat, lng] que es lo que Leaflet usa
  const positions = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
  const previewCierre =
    vertices.length >= 3
      ? [positions[positions.length - 1], positions[0]]
      : null;

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
          <CapturadorClicks onClick={agregarVertice} />
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
            <span className="ml-1 text-estado-vencida">(necesitás al menos 3)</span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={deshacer}
            disabled={vertices.length === 0 || pending}
            className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-xs text-zelanda-verde-700 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> Deshacer
          </button>
          <button
            type="button"
            onClick={limpiar}
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
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add "app/(app)/jefe/lotes/[id]/poligono"
git commit -m "feat(mapa): editor de poligono por lote con calculo de hectareas"
```

---

## Task 6: Editor de punto compartido + acciones

**Files:**
- Create: `components/mapa/EditorPunto.tsx`
- Create: `components/mapa/EditorPuntoCargador.tsx`
- Create: `lib/acciones-mapa.ts` (acciones para apiarios + instalaciones)

- [ ] **Step 1: Componente cliente**

`components/mapa/EditorPunto.tsx`:
```tsx
"use client";

import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
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
```

`components/mapa/EditorPuntoCargador.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const EditorPunto = dynamic(() => import("./EditorPunto"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

type LngLat = [number, number];

export function EditorPuntoCargador({
  inicial,
  hiddenName,
}: {
  inicial: LngLat | null;
  hiddenName: string;
}) {
  const [punto, setPunto] = useState<LngLat | null>(inicial);
  return (
    <>
      <EditorPunto inicial={inicial} onChange={setPunto} />
      <input
        type="hidden"
        name={hiddenName}
        value={punto ? JSON.stringify(punto) : ""}
      />
    </>
  );
}
```

- [ ] **Step 2: Acciones**

`lib/acciones-mapa.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { puntoAWkt, type LngLat } from "@/lib/geo";
import { arrayAWktPolygon } from "@/lib/geo";

export type EstadoEdicion = { error: string | null };

function parsePunto(raw: string): LngLat | null {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [lng, lat] = v;
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    return [lng, lat];
  } catch {
    return null;
  }
}

export async function guardarCoordsApiario(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("apiario_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Apiario inválido." };
  const pto = parsePunto(String(formData.get("punto") ?? ""));
  if (!pto) return { error: "Tocá la ubicación en el mapa antes de guardar." };
  const wkt = puntoAWkt(pto[0], pto[1]);
  await prisma.$executeRawUnsafe(
    `UPDATE apiarios SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
    wkt,
    BigInt(idRaw),
  );
  revalidatePath("/jefe/lotes");
  revalidatePath(`/jefe/apiarios/${idRaw}`);
  redirect(`/jefe/apiarios/${idRaw}`);
}

export async function guardarCoordsInstalacion(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const idRaw = String(formData.get("instalacion_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Instalación inválida." };
  const pto = parsePunto(String(formData.get("punto") ?? ""));
  if (!pto) return { error: "Tocá la ubicación en el mapa antes de guardar." };
  const wkt = puntoAWkt(pto[0], pto[1]);
  await prisma.$executeRawUnsafe(
    `UPDATE instalaciones SET coordenadas = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
    wkt,
    BigInt(idRaw),
  );
  revalidatePath("/jefe/lotes");
  revalidatePath("/jefe/instalaciones");
  redirect("/jefe/instalaciones");
}

export async function crearInstalacion(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!["CASA", "BODEGA", "ALMACEN", "OTRO"].includes(tipo))
    return { error: "Tipo inválido." };
  const creada = await prisma.instalaciones.create({
    data: { nombre, tipo: tipo as "CASA" | "BODEGA" | "ALMACEN" | "OTRO", notas, activo: true },
  });
  revalidatePath("/jefe/instalaciones");
  redirect(`/jefe/instalaciones/${creada.id}/ubicacion`);
}

export async function guardarBordeFinca(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");
  const verticesRaw = String(formData.get("vertices") ?? "[]");
  let vertices: LngLat[];
  try {
    vertices = JSON.parse(verticesRaw);
  } catch {
    return { error: "Formato inválido." };
  }
  if (!Array.isArray(vertices) || vertices.length < 3)
    return { error: "El polígono necesita al menos 3 puntos." };
  let wkt: string;
  try {
    wkt = arrayAWktPolygon(vertices);
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Garantizar 1 sola fila
  const fila = await prisma.finca.findFirst();
  if (fila) {
    await prisma.$executeRawUnsafe(
      `UPDATE finca SET poligono = ST_GeomFromText($1, 4326)::geography WHERE id = $2`,
      wkt,
      fila.id,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO finca (nombre, poligono) VALUES ('Hacienda La Zelanda', ST_GeomFromText($1, 4326)::geography)`,
      wkt,
    );
  }
  revalidatePath("/jefe/lotes");
  revalidatePath("/jefe/instalaciones");
  redirect("/jefe/instalaciones");
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add components/mapa/EditorPunto.tsx components/mapa/EditorPuntoCargador.tsx lib/acciones-mapa.ts
git commit -m "feat(mapa): editor de punto compartido y acciones de mapa"
```

---

## Task 7: Pantalla `/jefe/instalaciones` + sub-rutas

**Files:**
- Create: `app/(app)/jefe/instalaciones/page.tsx`
- Create: `app/(app)/jefe/instalaciones/nueva/page.tsx`
- Create: `app/(app)/jefe/instalaciones/nueva/_formulario.tsx`
- Create: `app/(app)/jefe/instalaciones/[id]/ubicacion/page.tsx`
- Create: `app/(app)/jefe/instalaciones/[id]/ubicacion/_formulario.tsx`
- Create: `app/(app)/jefe/instalaciones/finca/page.tsx` (editor de borde)
- Create: `app/(app)/jefe/instalaciones/finca/_editor.tsx`

- [ ] **Step 1: Pantalla índice**

`page.tsx`:
```tsx
import Link from "next/link";
import { Home, PackageOpen, Warehouse, MapPin, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Instalaciones" };

const ICONO: Record<string, typeof Home> = {
  CASA: Home,
  BODEGA: PackageOpen,
  ALMACEN: Warehouse,
  OTRO: MapPin,
};

export default async function PaginaInstalaciones() {
  await requerirUsuario("JEFE");

  const [instalaciones, fincaRows] = await Promise.all([
    prisma.$queryRaw<{
      id: bigint;
      nombre: string;
      tipo: string;
      tiene_coords: boolean;
    }[]>`
      SELECT id, nombre, tipo::text, coordenadas IS NOT NULL AS tiene_coords
      FROM instalaciones
      WHERE activo = TRUE
      ORDER BY tipo, nombre
    `,
    prisma.$queryRaw<{ tiene: boolean }[]>`
      SELECT poligono IS NOT NULL AS tiene FROM finca LIMIT 1
    `,
  ]);
  const fincaTieneBorde = fincaRows[0]?.tiene === true;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Mapa
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Instalaciones y borde de la finca
        </h1>
      </header>

      <Link
        href="/jefe/instalaciones/finca"
        className="block rounded-xl border border-zelanda-ocre-300 bg-zelanda-ocre-50 p-4 shadow-card"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Borde de la finca
            </p>
            <p className="mt-1 font-serif text-lg text-zelanda-verde-900">
              Hacienda La Zelanda
            </p>
            <p className="mt-1 text-xs text-zelanda-verde-700">
              {fincaTieneBorde ? "Capturado" : "Pendiente de capturar"}
            </p>
          </div>
          <span className="text-sm text-zelanda-verde-700">
            {fincaTieneBorde ? "Editar →" : "Capturar →"}
          </span>
        </div>
      </Link>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Instalaciones ({instalaciones.length})
          </h2>
          <Link
            href="/jefe/instalaciones/nueva"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-1.5 text-xs text-zelanda-verde-700"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Link>
        </div>
        <ul className="space-y-2">
          {instalaciones.map((i) => {
            const Icono = ICONO[i.tipo] ?? MapPin;
            return (
              <li key={i.id.toString()}>
                <Link
                  href={`/jefe/instalaciones/${i.id}/ubicacion`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
                >
                  <div className="flex items-center gap-2">
                    <Icono className="h-4 w-4 text-zelanda-verde-700" />
                    <div>
                      <p className="font-medium text-zelanda-verde-900">
                        {i.nombre}
                      </p>
                      <p className="text-xs text-zelanda-verde-700">
                        {i.tipo} · {i.tiene_coords ? "Capturado" : "Pendiente"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-zelanda-verde-700">
                    {i.tiene_coords ? "Editar →" : "Capturar →"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Form crear nueva**

`nueva/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { FormularioNuevaInstalacion } from "./_formulario";

export const metadata = { title: "Nueva instalación" };

export default async function Page() {
  await requerirUsuario("JEFE");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Mapa
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva instalación
        </h1>
      </header>
      <FormularioNuevaInstalacion />
    </div>
  );
}
```

`nueva/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { crearInstalacion, type EstadoEdicion } from "@/lib/acciones-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioNuevaInstalacion() {
  const [estado, formAction, pending] = useActionState(
    crearInstalacion,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          name="nombre"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Tipo
        </label>
        <select
          name="tipo"
          required
          defaultValue="OTRO"
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="CASA">Casa</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>
      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear y capturar ubicación"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Editor de ubicación de instalación**

`[id]/ubicacion/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioUbicacionInstalacion } from "./_formulario";

export const metadata = { title: "Ubicación" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const inst = await prisma.instalaciones.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true, tipo: true },
  });
  if (!inst) notFound();

  const rows = await prisma.$queryRaw<{ pto: string | null }[]>`
    SELECT ST_AsGeoJSON(coordenadas)::text AS pto FROM instalaciones WHERE id = ${BigInt(id)}
  `;
  let inicial: [number, number] | null = null;
  if (rows[0]?.pto) {
    try {
      const obj = JSON.parse(rows[0].pto);
      if (obj?.type === "Point") inicial = obj.coordinates;
    } catch { /* noop */ }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/jefe/instalaciones"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Ubicación
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {inst.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá en el mapa donde está {inst.nombre.toLowerCase()}. Podés
          reposicionar tocando otra vez.
        </p>
      </header>
      <FormularioUbicacionInstalacion
        instalacionId={inst.id.toString()}
        inicial={inicial}
      />
    </div>
  );
}
```

`[id]/ubicacion/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { EditorPuntoCargador } from "@/components/mapa/EditorPuntoCargador";
import { guardarCoordsInstalacion, type EstadoEdicion } from "@/lib/acciones-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioUbicacionInstalacion({
  instalacionId,
  inicial,
}: {
  instalacionId: string;
  inicial: [number, number] | null;
}) {
  const [estado, formAction, pending] = useActionState(
    guardarCoordsInstalacion,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="instalacion_id" value={instalacionId} />
      <EditorPuntoCargador inicial={inicial} hiddenName="punto" />
      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar ubicación"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Editor del borde de la finca**

`finca/page.tsx`:
```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditorBordeCargador } from "./_editor";

export const metadata = { title: "Borde de la finca" };

export default async function Page() {
  await requerirUsuario("JEFE");
  const rows = await prisma.$queryRaw<{ geojson: string | null }[]>`
    SELECT ST_AsGeoJSON(poligono)::text AS geojson FROM finca LIMIT 1
  `;
  const geojson = rows[0]?.geojson ?? null;
  return (
    <div className="space-y-4">
      <Link
        href="/jefe/instalaciones"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Borde
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hacienda La Zelanda
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá cada esquina del borde de la finca. Cuando termines, "Cerrar y guardar".
        </p>
      </header>
      <EditorBordeCargador geojsonInicial={geojson} />
    </div>
  );
}
```

`finca/_editor.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";

const EditorBorde = dynamic(() => import("./_editor-cliente"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-100 text-sm text-zelanda-verde-700">
      Cargando mapa…
    </div>
  ),
});

export function EditorBordeCargador(props: { geojsonInicial: string | null }) {
  return <EditorBorde {...props} />;
}
```

`finca/_editor-cliente.tsx`: similar al `EditorPoligono` del lote (Task 5) pero apuntando a `guardarBordeFinca`. Para evitar duplicación, se puede componer:

```tsx
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
import { guardarBordeFinca, type EstadoEdicion } from "@/lib/acciones-mapa";

type LngLat = [number, number];

const ESTADO_INICIAL: EstadoEdicion = { error: null };
const CENTRO_QUINDIO: [number, number] = [4.535, -75.681];

function Capturador({
  onClick,
}: {
  onClick: (lng: number, lat: number) => void;
}) {
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

export default function EditorBorde({
  geojsonInicial,
}: {
  geojsonInicial: string | null;
}) {
  const iniciales = useMemo(
    () => parseGeojsonInicial(geojsonInicial),
    [geojsonInicial],
  );
  const [vertices, setVertices] = useState<LngLat[]>(iniciales);
  const [estado, formAction, pending] = useActionState(
    guardarBordeFinca,
    ESTADO_INICIAL,
  );

  const positions = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
  const previewCierre =
    vertices.length >= 3
      ? [positions[positions.length - 1], positions[0]]
      : null;
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
          zoom={iniciales.length > 0 ? 15 : 14}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <Capturador onClick={(lng, lat) => setVertices((p) => [...p, [lng, lat]])} />
          {positions.length >= 2 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: "#c89045", weight: 3, dashArray: "8,6" }}
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
          className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Cerrar y guardar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add "app/(app)/jefe/instalaciones"
git commit -m "feat(mapa): pantallas instalaciones index + nueva + ubicacion + borde finca"
```

---

## Task 8: Pantalla `/jefe/apiarios/[id]/ubicacion`

**Files:**
- Create: `app/(app)/jefe/apiarios/[id]/ubicacion/page.tsx`
- Create: `app/(app)/jefe/apiarios/[id]/ubicacion/_formulario.tsx`

- [ ] **Step 1: Page**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioUbicacionApiario } from "./_formulario";

export const metadata = { title: "Ubicación apiario" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const ap = await prisma.apiarios.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, nombre: true },
  });
  if (!ap) notFound();

  const rows = await prisma.$queryRaw<{ pto: string | null }[]>`
    SELECT ST_AsGeoJSON(coordenadas)::text AS pto FROM apiarios WHERE id = ${BigInt(id)}
  `;
  let inicial: [number, number] | null = null;
  if (rows[0]?.pto) {
    try {
      const obj = JSON.parse(rows[0].pto);
      if (obj?.type === "Point") inicial = obj.coordinates;
    } catch { /* noop */ }
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/jefe/apiarios/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al apiario
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Ubicación
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Apiario {ap.nombre}
        </h1>
        <p className="mt-2 text-sm text-zelanda-verde-700">
          Tocá en el mapa donde está el apiario.
        </p>
      </header>
      <FormularioUbicacionApiario apiarioId={ap.id.toString()} inicial={inicial} />
    </div>
  );
}
```

- [ ] **Step 2: Formulario**

```tsx
"use client";

import { useActionState } from "react";
import { EditorPuntoCargador } from "@/components/mapa/EditorPuntoCargador";
import { guardarCoordsApiario, type EstadoEdicion } from "@/lib/acciones-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioUbicacionApiario({
  apiarioId,
  inicial,
}: {
  apiarioId: string;
  inicial: [number, number] | null;
}) {
  const [estado, formAction, pending] = useActionState(
    guardarCoordsApiario,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="apiario_id" value={apiarioId} />
      <EditorPuntoCargador inicial={inicial} hiddenName="punto" />
      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar ubicación"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add "app/(app)/jefe/apiarios/[id]/ubicacion"
git commit -m "feat(mapa): editor de ubicacion para apiarios"
```

---

## Task 9: Botones de acceso desde lote/apiario detail + dashboard

**Files:**
- Modify: `app/(app)/jefe/lotes/[id]/page.tsx` (botón "Dibujar/Editar polígono")
- Modify: `app/(app)/jefe/apiarios/[id]/page.tsx` (botón "Capturar ubicación")
- Modify: `app/(app)/jefe/page.tsx` (link a `/jefe/instalaciones` en sección Operación)

- [ ] **Step 1: Botón en detalle de lote**

Buscar el área de botones del header de `/jefe/lotes/[id]/page.tsx` (donde ya está "Reporte" y "Editar"). Agregar un tercer link:
```tsx
<Link
  href={`/jefe/lotes/${lote.id}/poligono`}
  className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
>
  <MapPin className="h-4 w-4" />
  Polígono
</Link>
```

Agregar `import { MapPin } from "lucide-react"` si no está.

- [ ] **Step 2: Botón en detalle de apiario**

`app/(app)/jefe/apiarios/[id]/page.tsx`: agregar en el header similar.
```tsx
<Link
  href={`/jefe/apiarios/${apiario.id}/ubicacion`}
  className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800"
>
  <MapPin className="h-4 w-4" />
  Ubicación
</Link>
```

- [ ] **Step 3: Link en dashboard jefe**

En el grid de la sección "Operación" de `/jefe/page.tsx`, agregar una 4ª tarjeta:
```tsx
<Link
  href="/jefe/instalaciones"
  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
>
  <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
    Mapa
  </p>
  <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
    Capturar
  </p>
</Link>
```

Ajustar `sm:grid-cols-3` a `sm:grid-cols-4` si es necesario.

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add "app/(app)/jefe/lotes/[id]/page.tsx" "app/(app)/jefe/apiarios/[id]/page.tsx" "app/(app)/jefe/page.tsx"
git commit -m "feat(mapa): botones acceso a editor de poligono y ubicacion + link dashboard"
```

---

## Task 10: Verificación final y push

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Smoke test después del deploy**

1. SQL Editor de Supabase → ejecutar `supabase/migracion-fase-mapa.sql`. Verificar 3 instalaciones + 1 fila en `finca`.
2. Abrir `/jefe/instalaciones` → ver 3 instalaciones + borde de finca arriba.
3. Capturar borde de la finca (tap-tap-tap-cerrar).
4. Capturar 3 instalaciones (1 tap por cada una).
5. Capturar ubicación del Apiario El Cedro.
6. Dibujar polígono de Armenia (lote): ir a `/jefe/lotes/<id-armenia>` → "Polígono" → dibujar.
7. `/jefe/lotes` ahora muestra el polígono coloreado de Armenia con su nombre dentro.
8. Verificar que las hectáreas se calcularon (mirar en el detalle del lote).
9. Tap en el polígono → navega al detalle del lote.
10. Leyenda visible abajo del mapa con el chip de color + nombre Armenia.

---

## Self-review

- [x] Cada tarea tiene archivos exactos y código completo.
- [x] SQL idempotente.
- [x] Acciones server validan rol JEFE.
- [x] BigInt y Decimal serializados antes de pasar a cliente.
- [x] `$executeRawUnsafe` con params posicionales para `$1` duplicado (cálculo de hectáreas con el mismo WKT).
- [x] Validación mínima de 3 vértices.
- [x] PostGIS calcula hectáreas automáticamente.
- [x] Mapa responsive con altura `vh` para mobile.
- [x] Iconos SVG inline (sin assets externos) en divIcons de instalaciones.
- [x] Tests = build + lint + smoke test manual.
