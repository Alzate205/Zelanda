# Mapa Leaflet + Captura de Polígonos — Diseño

> Fecha: 2026-05-19
> Cierra deuda de Fase 2 (CLAUDE.md §9).

## 1. Objetivo

Vista satelital con los 15 lotes dibujados como polígonos, los 2 apiarios como puntos, las 3 instalaciones (casa, bodega, almacén) como puntos, y el borde de la finca como referencia general. Editor didáctico para que el dueño capture los polígonos una vez por lote.

## 2. Constraints clave

- Todo es aguacate Hass — el color del polígono solo distingue lotes entre sí, **no comunica alerta**.
- Las alertas (vencidas, próximas) viven en el dashboard del jefe, no en el mapa.
- El dueño dibuja una sola vez por lote. Mobile-first.
- PostGIS ya está activo y los campos `lotes.poligono` y `apiarios.coordenadas` existen como `GEOGRAPHY`.

## 3. Cambios de esquema

`supabase/migracion-fase-mapa.sql`:

```sql
BEGIN;

-- Enum solo si no existe
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

-- RLS
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

Reflejar en `esquema.sql`.

**Prisma:** los campos GEOGRAPHY siguen como `Unsupported("geography")` (igual que `lotes.poligono` y `apiarios.coordenadas`). Lectura/escritura por `$queryRaw`/`$executeRaw` con funciones PostGIS.

## 4. Helpers `lib/geo.ts`

```ts
export type LngLat = [number, number]; // [lng, lat]

export function arrayAWktPolygon(puntos: LngLat[]): string {
  // Cierra el anillo si no está cerrado
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
```

## 5. Paleta de colores

`lib/paleta-lotes.ts`:
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

Asignación por id (no por orden alfabético) para que cada lote tenga su color estable sin importar reordenamientos.

## 6. Mapa principal `/jefe/lotes`

### Datos
```ts
const lotes = await prisma.$queryRaw<{
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
`;

const apiarios = await prisma.$queryRaw<{
  id: bigint; nombre: string; total_colmenas: number;
  punto_geojson: string | null;
}[]>`
  SELECT id, nombre, total_colmenas,
    ST_AsGeoJSON(coordenadas)::text AS punto_geojson
  FROM apiarios
  WHERE activo = TRUE
`;

const instalaciones = await prisma.$queryRaw<{
  id: bigint; nombre: string; tipo: string;
  punto_geojson: string | null;
}[]>`
  SELECT id, nombre, tipo::text,
    ST_AsGeoJSON(coordenadas)::text AS punto_geojson
  FROM instalaciones
  WHERE activo = TRUE
  ORDER BY tipo, nombre
`;

const finca = await prisma.$queryRaw<{
  poligono_geojson: string | null;
}[]>`
  SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson
  FROM finca LIMIT 1
`;
```

### Render (componente `MapaFinca` extendido)
- Tile satelital Esri (ya implementado).
- Para cada lote con polígono: `<GeoJSON>` con `pathOptions: { color: colorDeLote(id), fillColor: colorDeLote(id), fillOpacity: 0.35, weight: 2 }`.
- Para cada lote: `<Tooltip permanent direction="center">` con `<strong>{nombre}</strong><br/>{hectareas} ha`.
- Borde finca: `<GeoJSON>` con `pathOptions: { color: "#c89045", weight: 2, dashArray: "8,6", fillOpacity: 0 }`.
- Apiarios: divIcon hexágono ocre (ya existe, mantener).
- Instalaciones: divIcons por tipo:
  - CASA: círculo blanco con `Home` SVG.
  - BODEGA: círculo blanco con `PackageOpen` SVG.
  - ALMACEN: círculo blanco con `Warehouse` SVG.
  - OTRO: círculo blanco con punto.
- Centro: si hay borde de finca → centroide. Si no, fallback Quindío.
- Zoom inicial: si hay borde, `fitBounds(borde)`. Si no, zoom 13.
- Click en polígono de lote → navega a `/jefe/lotes/[id]`.
- Controles:
  - `L.control.scale({ imperial: false })` agregado al `whenCreated`.
  - Control custom "N↑" arriba-derecha (HTML simple en `Control extend`).
  - Leyenda abajo-izquierda: caja blanca con borde, título "Hacienda La Zelanda", lista de lotes con chip de color + nombre.

### Banner de captura pendiente
Si `(lotes sin polígono) + (apiarios sin punto) + (instalaciones sin punto) + (sin borde finca) > 0`:
```
[i] Faltan capturar: 3 lotes, 1 apiario, 2 instalaciones, borde de la finca
   [Ir a captura →]   → /jefe/instalaciones
```

## 7. Editor de polígono `/jefe/lotes/[id]/poligono`

### Layout
```
┌────────────────────────────────────────┐
│ ← Volver al lote · Polígono de Armenia │  (header chico)
│                                        │
│ Tocá cada esquina del lote. Cuando     │  (texto didáctico)
│ termines, "Cerrar y guardar".          │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │      [MAPA GRANDE]                 │ │  (height min 70vh)
│ │      Tap = vértice                 │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Vértices: 4   [Deshacer] [Limpiar]    │  (controles)
│                                        │
│ [Cerrar y guardar]                    │  (CTA grande)
└────────────────────────────────────────┘
```

### Componente cliente `EditorPoligono.tsx`
- Estado: `vertices: LngLat[]`.
- `useMapEvents({ click: (e) => setVertices(p => [...p, [e.latlng.lng, e.latlng.lat]]) })`.
- Render:
  - Cada vértice como `<CircleMarker radius={6} color="#c89045">` numerado en tooltip.
  - `<Polyline positions={vertices.map([lng,lat]=>[lat,lng])}>` para mostrar línea.
  - Si hay ≥ 3 vértices: preview de cierre con `<Polyline positions={[ultimoVertice, primerVertice]} dashArray="4,4">`.
- Si ya hay polígono guardado: lo carga como vértices iniciales (sin el cierre duplicado).
- Validación al guardar: mínimo 3 vértices.

### Server action `guardarPoligono(loteId, vertices)`
```ts
const wkt = arrayAWktPolygon(vertices);
await prisma.$executeRaw`
  UPDATE lotes
  SET poligono = ST_GeomFromText(${wkt}, 4326)::geography,
      hectareas = ST_Area(ST_GeomFromText(${wkt}, 4326)::geography) / 10000,
      updated_at = NOW()
  WHERE id = ${BigInt(loteId)}
`;
```

Después de guardar: redirect a `/jefe/lotes/[id]`.

### Botón "Eliminar polígono" (opcional)
En el editor, si ya hay polígono, botón secundario "Quitar polígono" que ejecuta `UPDATE lotes SET poligono = NULL, hectareas = NULL WHERE id = X`. Confirmación inline antes de ejecutar.

## 8. Editor de punto (apiarios e instalaciones)

### Componente cliente `EditorPunto.tsx`
- Estado: `punto: LngLat | null`.
- `useMapEvents({ click: (e) => setPunto([e.latlng.lng, e.latlng.lat]) })`.
- Render: `<Marker position={[lat,lng]} icon={iconoSegun(tipo)}>` (solo 1 marker).
- Si ya hay punto guardado: lo carga.
- Botón "Quitar" si querés borrarlo.

### Pantalla `/jefe/apiarios/[id]/ubicacion`
- Header: "Capturar ubicación del Apiario X".
- Texto: "Tocá en el mapa donde está el apiario. Podés reposicionar tocando otra vez."
- Mapa con `EditorPunto`.
- Botón "Guardar" → server action.

### Pantalla `/jefe/instalaciones/[id]/ubicacion`
- Igual al anterior pero para instalación.

### Server actions
```ts
guardarCoordsApiario(apiarioId, lng, lat)
guardarCoordsInstalacion(instalacionId, lng, lat)
```

Con `ST_GeomFromText(puntoAWkt(lng, lat), 4326)::geography`.

## 9. Pantalla `/jefe/instalaciones`

### Lista
```
┌────────────────────────────────────────┐
│ Instalaciones de la finca              │
│                                        │
│ ━━━━━ Borde de la finca ━━━━━          │
│ □ Pendiente de capturar                │  (o ✓ Capturado)
│ [Capturar/Editar →]                   │
│                                        │
│ ─────                                  │
│                                        │
│ 🏠 Casa principal · CASA               │
│ □ Pendiente                            │
│ [Capturar →]                          │
│                                        │
│ 📦 Bodega · BODEGA                     │
│ ✓ Capturado                            │
│ [Editar →]                            │
│                                        │
│ ...                                    │
│                                        │
│ [+ Nueva instalación]                 │
└────────────────────────────────────────┘
```

(Iconos vienen de lucide-react no de emojis — solo son ilustrativos acá).

### `/jefe/instalaciones/nueva`
Form simple: nombre + tipo + notas. Después de crear, redirect a `/jefe/instalaciones/[id]/ubicacion`.

### `/jefe/instalaciones/finca` (alias / link al editor del borde)
Reutiliza el mismo componente de editor de polígono pero apuntando a la tabla `finca`. Único registro siempre.

## 10. Botones de acceso

- `/jefe/lotes/[id]` → si `poligono` es null, botón "Dibujar polígono"; si no, "Editar polígono".
- `/jefe/apiarios/[id]` → botón "Capturar ubicación" o "Editar ubicación".
- Dashboard `/jefe` → agregar link "Mapa y polígonos" en la sección "Operación" (junto con "Stock bajo" / "Despachos abiertos" / "Almacén"). Lleva a `/jefe/instalaciones` que es el índice de captura. Cuando todo esté capturado, este link sigue siendo útil para editar.

## 11. UX

- Mobile-first: el editor de polígono debe ocupar al menos 70% de la pantalla útil para que el dueño pueda tocar con precisión.
- Botones grandes (`min-h-touch`).
- En zoom muy bajo, los polígonos chiquitos pueden ser ilegibles — el tooltip permanente con el nombre evita confusión.
- Si el dueño hace tap pero el dedo cubre el área, considerar mover el punto exacto con un `.5px tap offset` (no, no vale la pena el over-engineering al inicio).
- Sin emojis, todo institucional verde y ocre.

## 12. Decisiones explícitas

| # | Decisión | Razón |
|---|---|---|
| 1 | Colores por id de lote, no por estado | El usuario fue claro: color = identificación, no alerta. |
| 2 | Tabla `finca` con 1 fila | Más simple que agregar campo a tabla settings; representa una entidad real (la finca tiene borde). |
| 3 | Lotes sin polígono no se muestran en mapa | CircleMarker placeholder sería confuso visualmente. La lista debajo del mapa los muestra. |
| 4 | Edición simple: reemplazar todo el polígono | Editor "agregar vértice individual" es complejo. Si el dueño se equivoca, dibuja de nuevo (15 lotes una vez). |
| 5 | Hectáreas calculadas automáticamente con PostGIS | Evita inputs manuales; usa ST_Area. |
| 6 | Tooltip permanente con nombre + hectáreas | Replica el estilo de la imagen de referencia. |
| 7 | Borde de finca como referencia visual (línea dashed) | Da contexto al mapa sin competir con los polígonos de lotes. |
| 8 | Captura "una sola vez" en flujo dedicado | El dueño se sienta una tarde, captura todo, no se vuelve a tocar. |
| 9 | Sin íconos de alerta en el mapa | El mapa es para navegación visual, no para alertar. |
| 10 | Acceso desde dashboard del jefe | Link discreto en sección Operación, sin tocar bottom nav. |

## 13. Tests manuales (después del deploy)

1. SQL aplicado → ver 3 instalaciones y 1 fila en `finca` en Supabase.
2. `/jefe/lotes` carga sin error (lotes existen sin polígonos todavía).
3. `/jefe/instalaciones` muestra los 4 items pendientes.
4. Dibujar polígono de Armenia con 4-5 puntos → guardar → ver en mapa principal coloreado.
5. Capturar coords de Casa principal → ver punto en mapa.
6. Capturar coords de Apiario El Cedro → ver hexágono ocre.
7. Capturar borde de la finca → ver línea amarilla discontinua envolviendo todo.
8. Verificar leyenda + escala + N↑.
9. Tap en polígono de Armenia → navega a `/jefe/lotes/[id]`.
10. Hectáreas del lote = lo calculado por ST_Area (verificar que tenga sentido vs la realidad).
