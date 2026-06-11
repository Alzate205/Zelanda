# Fase A — Velocidad: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir a la mitad el tiempo de navegación de la app sin cambiar ninguna funcionalidad (spec: `docs/superpowers/specs/2026-06-10-zelanda-2-0-design.md`, Fase A).

**Architecture:** Seis arreglos independientes: (1) deduplicar la verificación de sesión con `cache()` de React + validación local del JWT con `getClaims()`; (2) navegación del mapa con el router de Next en vez de recarga completa; (3) logos WebP de ~40KB en vez de PNG de 1.2MB; (4) esqueletos `loading.tsx`; (5) `unstable_cache` para las queries geo con tag `geo-finca`; (6) cache de baldosas satelitales en el service worker.

**Tech Stack:** Next.js 15 App Router, React 19 (`cache`), @supabase/supabase-js 2.105 (`getClaims`), sharp (ya en node_modules), Service Worker.

**Convenciones del proyecto:** todo en español, sin emojis en UI, commits descriptivos en español, `npm run ci` = lint + vitest + build. Los tests viven colocados en `lib/*.test.ts` y corren con `npm run test` (vitest).

---

### Task 1: Autenticación — una sola verificación por petición

Hoy `requerirUsuario()` se llama 2 veces por navegación (layout + página) y cada llamada hace 2 viajes de red (`auth.getUser()` + select a `usuarios`). Con `cache()` de React las 2 llamadas comparten resultado, y `getClaims()` valida el JWT localmente (con llaves asimétricas no viaja a Supabase; con llave simétrica hace 1 viaje, igual que antes pero una sola vez).

**Files:**

- Modify: `lib/auth.ts`
- Test: `lib/auth.test.ts` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const mockGetClaims = vi.fn();
const mockSingle = vi.fn();
vi.mock('./supabase/server', () => ({
  crearClienteSupabaseServidor: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mockSingle })),
      })),
    })),
  })),
}));

import { obtenerUsuarioActual } from './auth';

describe('obtenerUsuarioActual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve null si no hay sesión (claims vacíos)', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });
    expect(await obtenerUsuarioActual()).toBeNull();
  });

  it('devuelve null si getClaims da error', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: 'token inválido' },
    });
    expect(await obtenerUsuarioActual()).toBeNull();
  });

  it('devuelve el usuario cuando hay claims y fila en usuarios', async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: 'uuid-1' } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'uuid-1',
        email: 'jefe@zelanda.co',
        nombre_completo: 'Samuel Alzate',
        rol: 'JEFE',
        persona_id: 1,
        activo: true,
      },
      error: null,
    });
    const usuario = await obtenerUsuarioActual();
    expect(usuario?.rol).toBe('JEFE');
    expect(usuario?.id).toBe('uuid-1');
  });

  it('devuelve null si no hay fila en usuarios', async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: 'uuid-2' } },
      error: null,
    });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    expect(await obtenerUsuarioActual()).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL — el código actual usa `getUser()`, no `getClaims()`, así que "devuelve el usuario cuando hay claims..." falla (el mock de `getUser` no existe → `usuario` es null).

- [ ] **Step 3: Implementar el cambio en `lib/auth.ts`**

Reemplazar el contenido de `obtenerUsuarioActual` y envolverlo en `cache()`:

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteSupabaseServidor } from './supabase/server';
import { RUTA_INICIO_POR_ROL } from './constantes';
import type { RolUsuario } from '@/types';

export type UsuarioActual = {
  id: string;
  email: string;
  nombre_completo: string;
  rol: RolUsuario;
  persona_id: number | null;
  activo: boolean;
};

/**
 * Cacheado por petición con cache() de React: layout y página comparten
 * una sola verificación. getClaims() valida el JWT localmente cuando el
 * proyecto usa llaves asimétricas (cero viajes a Supabase Auth); el
 * refresh del token sigue a cargo del middleware.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const supabase = await crearClienteSupabaseServidor();
  const { data: claimsData, error: errorClaims } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (errorClaims || !sub) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre_completo, rol, persona_id, activo')
    .eq('id', sub)
    .single();

  if (error || !data) return null;
  return data as UsuarioActual;
});

/**
 * Para usar en layouts/páginas server-side: redirige a /login si no hay
 * sesión, y a la home del rol propio si el rol no coincide con el requerido.
 */
export async function requerirUsuario(rolRequerido?: RolUsuario): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !usuario.activo) {
    redirect('/login');
  }
  if (rolRequerido && usuario.rol !== rolRequerido) {
    redirect(RUTA_INICIO_POR_ROL[usuario.rol]);
  }
  return usuario;
}
```

Nota: `requerirUsuario` no cambia. Ningún consumidor cambia (la firma es idéntica).

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run lib/auth.test.ts`
Expected: PASS (4 tests)

Run: `npm run test`
Expected: PASS — la suite completa sigue verde.

- [ ] **Step 5: Verificar tipos y commit**

Run: `npm run check:types`
Expected: sin errores.

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "perf: deduplicar verificación de sesión con cache() y getClaims()"
```

---

### Task 2: Mapa — navegación sin recargar la app

**Files:**

- Modify: `components/mapa/MapaFinca.tsx`

- [ ] **Step 1: Reemplazar `window.location.href` por el router**

En `components/mapa/MapaFinca.tsx`:

1. Agregar el import (junto a los demás):

```ts
import { useRouter } from 'next/navigation';
```

2. Dentro del componente `MapaFinca`, antes del `return`:

```ts
const router = useRouter();
```

3. Reemplazar el `eventHandlers` del `<GeoJSON>` de lotes (líneas ~184-190):

```ts
eventHandlers={{
  click: () => router.push(`/jefe/lotes/${l.id}`),
}}
```

- [ ] **Step 2: Verificar lint y build**

Run: `npm run lint && npm run build`
Expected: sin errores ni warnings.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev` y abrir `http://localhost:3000/jefe/lotes` logueado como jefe.
Expected: tocar un polígono navega al detalle del lote **sin** flash blanco de recarga completa (la bottom nav no parpadea).

- [ ] **Step 4: Commit**

```bash
git add components/mapa/MapaFinca.tsx
git commit -m "perf: navegación del mapa con router.push en vez de recarga completa"
```

---

### Task 3: Logos — de 1.2 MB PNG a ~40 KB WebP

`public/logo-zelanda.png` y `public/logo.png` (idénticos, 1.209.941 bytes cada uno) se usan en 6 lugares. Splash y login los cargan con `<img>` crudo (descarga completa del PNG); los otros 4 usan `next/image`.

**Files:**

- Create: `scripts/optimizar-logos.mjs`
- Create: `public/logo-zelanda.webp` (generado)
- Modify: `app/splash/page.tsx`, `app/(auth)/login/page.tsx`, `components/shared/BrandMark.tsx`, `components/shared/EmptyState.tsx`, `components/shared/AsignacionCerradaSuccess.tsx`, `components/shared/InstalarPWABanner.tsx`, `next.config.ts`
- Delete: `public/logo.png`, `public/logo-zelanda.png`

- [ ] **Step 1: Crear el script de conversión**

Crear `scripts/optimizar-logos.mjs`:

```js
// Convierte el logo PNG (1.2 MB) a WebP liviano. Uso: node scripts/optimizar-logos.mjs
import sharp from 'sharp';

const salida = await sharp('public/logo-zelanda.png')
  .resize({ width: 800, height: 800, fit: 'inside' })
  .webp({ quality: 88 })
  .toFile('public/logo-zelanda.webp');

console.log(`logo-zelanda.webp: ${salida.width}x${salida.height}, ${salida.size} bytes`);
```

- [ ] **Step 2: Ejecutarlo y verificar el tamaño**

Run: `node scripts/optimizar-logos.mjs`
Expected: imprime el tamaño; el archivo debe pesar **menos de 80.000 bytes**. Verificar con `ls public/logo-zelanda.webp`. Abrir el archivo y confirmar visualmente que se ve bien (fondo transparente intacto).

- [ ] **Step 3: Actualizar las 6 referencias**

En cada archivo, reemplazar la ruta:

- `app/splash/page.tsx:16` → `src="/logo-zelanda.webp"`
- `app/(auth)/login/page.tsx:36` → `src="/logo-zelanda.webp"` (antes apuntaba a `/logo.png`)
- `components/shared/BrandMark.tsx:23` → `src="/logo-zelanda.webp"`
- `components/shared/EmptyState.tsx:26` → `src="/logo-zelanda.webp"`
- `components/shared/AsignacionCerradaSuccess.tsx:29` → `src="/logo-zelanda.webp"`
- `components/shared/InstalarPWABanner.tsx:30` → `src="/logo-zelanda.webp"`

- [ ] **Step 3b: Modernizar la config de imágenes**

En `next.config.ts`, reemplazar el bloque `images` (el formato `domains` está deprecado y `formats` habilita AVIF/WebP en el optimizador):

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'gyburlhzvisgmdmfkqhx.supabase.co' },
    { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  ],
  formats: ['image/avif', 'image/webp'],
},
```

- [ ] **Step 4: Borrar los PNG y verificar que nada más los referencia**

Run: `git grep -n "logo.png\|logo-zelanda.png" -- ':!docs' ':!node_modules'`
Expected: cero resultados en código (solo docs históricos).

```bash
git rm public/logo.png public/logo-zelanda.png
```

- [ ] **Step 5: Build + verificación manual**

Run: `npm run build`
Expected: sin errores.

Run: `npm run dev` → abrir `/login` y `/splash`.
Expected: el logo se ve idéntico; en DevTools → Network, la descarga del logo pesa < 80 KB.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "perf: logo WebP de ~40KB en lugar de PNG de 1.2MB"
```

---

### Task 4: Esqueletos de carga (loading.tsx)

Sin `loading.tsx`, cada navegación queda congelada hasta que el servidor responde todo. Con esqueletos, la pantalla responde al instante.

**Files:**

- Create: `components/shared/Esqueleto.tsx`
- Create: `app/(app)/loading.tsx`
- Create: `app/(app)/jefe/loading.tsx`
- Create: `app/(app)/jefe/lotes/loading.tsx`

- [ ] **Step 1: Crear el componente base de esqueleto**

Crear `components/shared/Esqueleto.tsx`:

```tsx
export function Esqueleto({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-zelanda-beige-200/70 ${className}`} aria-hidden />
  );
}

/** Esqueleto genérico de pantalla: header + cards. */
export function EsqueletoPantalla() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-24" />
        <Esqueleto className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
      <Esqueleto className="h-32" />
      <Esqueleto className="h-32" />
      <Esqueleto className="h-32" />
    </div>
  );
}
```

- [ ] **Step 2: Crear los loading.tsx**

Crear `app/(app)/loading.tsx` (cubre TODAS las rutas de la app por defecto):

```tsx
import { EsqueletoPantalla } from '@/components/shared/Esqueleto';

export default function Cargando() {
  return <EsqueletoPantalla />;
}
```

Crear `app/(app)/jefe/loading.tsx` (con forma de dashboard):

```tsx
import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoJefe() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando panel">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-28" />
        <Esqueleto className="h-7 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
      <Esqueleto className="h-40" />
      <Esqueleto className="h-40" />
    </div>
  );
}
```

Crear `app/(app)/jefe/lotes/loading.tsx` (con forma de mapa):

```tsx
import { Esqueleto } from '@/components/shared/Esqueleto';

export default function CargandoLotes() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando mapa">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-32" />
        <Esqueleto className="h-7 w-44" />
      </div>
      <Esqueleto className="h-[60vh] rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5">
        <Esqueleto className="h-16" />
        <Esqueleto className="h-16" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build y comportamiento**

Run: `npm run lint && npm run build`
Expected: sin errores.

Run: `npm run dev` → navegar entre `/jefe`, `/jefe/lotes`, `/jefe/saldos` con DevTools en "Slow 4G".
Expected: al tocar un link, el esqueleto aparece al instante (no pantalla congelada).

- [ ] **Step 4: Commit**

```bash
git add components/shared/Esqueleto.tsx "app/(app)/loading.tsx" "app/(app)/jefe/loading.tsx" "app/(app)/jefe/lotes/loading.tsx"
git commit -m "perf: esqueletos de carga para navegación instantánea"
```

---

### Task 5: Cache de las queries geo con tag `geo-finca`

Los polígonos y puntos cambian solo cuando el jefe los edita. Hoy `/jefe/lotes` corre 6 queries (4 PostGIS) en cada visita.

**Files:**

- Create: `lib/geo-finca.ts`
- Modify: `app/(app)/jefe/lotes/page.tsx`
- Modify: `lib/acciones-mapa.ts` (3 acciones que mutan geometría + crearInstalacion)
- Modify: `app/(app)/jefe/lotes/[id]/poligono/acciones.ts` (2 acciones)

- [ ] **Step 1: Crear `lib/geo-finca.ts`**

Importante: `unstable_cache` serializa el resultado a JSON, así que los `bigint` de Prisma deben convertirse a `string`/`number` **dentro** de la función cacheada. El mapeo que hoy vive en la página se muda acá.

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { parseGeoJsonSafe } from '@/lib/geo';

type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };
type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

export type GeoFinca = {
  lotesParaMapa: {
    id: string;
    nombre: string;
    total_arboles: number;
    hectareas: number | null;
    geojson: GeoJsonPolygon | null;
  }[];
  apiariosParaMapa: {
    id: string;
    nombre: string;
    total_colmenas: number;
    ubicacion_descripcion: string | null;
    geojson: GeoJsonPoint | null;
  }[];
  instParaMapa: {
    id: string;
    nombre: string;
    tipo: 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO';
    geojson: GeoJsonPoint | null;
  }[];
  bordeFinca: GeoJsonPolygon | null;
};

const obtenerGeoFincaUncached = async (): Promise<GeoFinca> => {
  const [lotesRaw, apiariosRaw, instalacionesRaw, fincaRaw] = await Promise.all([
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        total_arboles: number;
        hectareas: string | null;
        poligono_geojson: string | null;
      }[]
    >`
      SELECT id, nombre, total_arboles, hectareas::text,
             ST_AsGeoJSON(poligono)::text AS poligono_geojson
      FROM lotes
      WHERE deleted_at IS NULL
      ORDER BY nombre
    `,
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        total_colmenas: number;
        ubicacion_descripcion: string | null;
        punto_geojson: string | null;
      }[]
    >`
      SELECT id, nombre, total_colmenas, ubicacion_descripcion,
             ST_AsGeoJSON(coordenadas)::text AS punto_geojson
      FROM apiarios
      WHERE activo = TRUE
      ORDER BY nombre
    `,
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        tipo: string;
        punto_geojson: string | null;
      }[]
    >`
      SELECT id, nombre, tipo::text,
             ST_AsGeoJSON(coordenadas)::text AS punto_geojson
      FROM instalaciones
      WHERE activo = TRUE
      ORDER BY tipo, nombre
    `,
    prisma.$queryRaw<{ poligono_geojson: string | null }[]>`
      SELECT ST_AsGeoJSON(poligono)::text AS poligono_geojson FROM finca LIMIT 1
    `,
  ]);

  return {
    lotesParaMapa: lotesRaw.map((l) => ({
      id: l.id.toString(),
      nombre: l.nombre,
      total_arboles: l.total_arboles,
      hectareas: l.hectareas !== null ? Number(l.hectareas) : null,
      geojson: parseGeoJsonSafe<GeoJsonPolygon>(l.poligono_geojson),
    })),
    apiariosParaMapa: apiariosRaw.map((a) => ({
      id: a.id.toString(),
      nombre: a.nombre,
      total_colmenas: a.total_colmenas,
      ubicacion_descripcion: a.ubicacion_descripcion,
      geojson: parseGeoJsonSafe<GeoJsonPoint>(a.punto_geojson),
    })),
    instParaMapa: instalacionesRaw.map((i) => ({
      id: i.id.toString(),
      nombre: i.nombre,
      tipo: i.tipo as 'CASA' | 'BODEGA' | 'ALMACEN' | 'OTRO',
      geojson: parseGeoJsonSafe<GeoJsonPoint>(i.punto_geojson),
    })),
    bordeFinca: parseGeoJsonSafe<GeoJsonPolygon>(fincaRaw[0]?.poligono_geojson ?? null),
  };
};

/** Geometrías de la finca, cacheadas 1 h. Invalidar con revalidateTag('geo-finca'). */
export const obtenerGeoFinca = unstable_cache(obtenerGeoFincaUncached, ['geo-finca'], {
  revalidate: 3600,
  tags: ['geo-finca'],
});
```

- [ ] **Step 2: Usar `obtenerGeoFinca` en `/jefe/lotes`**

En `app/(app)/jefe/lotes/page.tsx`:

- Borrar las 4 queries raw del `Promise.all` y todo el mapeo manual (`lotesParaMapa = lotesRaw.map(...)`, etc., líneas 19-104).
- Reemplazar por:

```ts
import { obtenerGeoFinca } from '@/lib/geo-finca';
// ...
const { lotesParaMapa, apiariosParaMapa, instParaMapa, bordeFinca } = await obtenerGeoFinca();
```

- Las listas inferiores (`lotesListMin`, `apListMin`) ahora salen de los mismos datos cacheados: usar `lotesParaMapa` (tiene `total_arboles` y `hectareas`) y `apiariosParaMapa` (tiene `ubicacion_descripcion`). Eliminar las 2 queries `findMany` y ajustar el JSX:

  - `lotesListMin.length` → `lotesParaMapa.length`; `apListMin.length` → `apiariosParaMapa.length`
  - En las cards de lotes: `key={lote.id}` (ya es string), `Number(lote.hectareas).toFixed(1)` → `lote.hectareas.toFixed(1)` (con guard `lote.hectareas != null`)
  - En las cards de apiarios: `key={a.id}`, resto igual.

- [ ] **Step 3: Invalidar el cache al editar geometría**

En `lib/acciones-mapa.ts` — agregar el import y la invalidación en las 4 acciones, junto a los `revalidatePath` existentes:

```ts
import { revalidatePath, revalidateTag } from 'next/cache';
// en guardarCoordsApiario, guardarCoordsInstalacion, crearInstalacion y guardarBordeFinca,
// inmediatamente antes de los revalidatePath:
revalidateTag('geo-finca');
```

En `app/(app)/jefe/lotes/[id]/poligono/acciones.ts` — lo mismo en `guardarPoligonoLote` y `quitarPoligonoLote`:

```ts
import { revalidatePath, revalidateTag } from 'next/cache';
// antes de los revalidatePath de cada acción:
revalidateTag('geo-finca');
```

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm run check:types && npm run build`
Expected: sin errores.

Run: `npm run dev` →

1. Abrir `/jefe/lotes` dos veces: la segunda carga no debe loguear queries PostGIS (con `log: ['query']` temporal o simplemente notarse más rápida).
2. Editar el polígono de un lote (`/jefe/lotes/<id>/poligono`), guardar → volver a `/jefe/lotes`.
   Expected: el polígono actualizado se ve de inmediato (la invalidación por tag funcionó).

- [ ] **Step 5: Commit**

```bash
git add lib/geo-finca.ts "app/(app)/jefe/lotes/page.tsx" lib/acciones-mapa.ts "app/(app)/jefe/lotes/[id]/poligono/acciones.ts"
git commit -m "perf: cachear geometrías de la finca con tag geo-finca"
```

---

### Task 6: Service worker — cache de baldosas satelitales

Hoy `sw.js` ignora todo lo que no sea mismo origen, así que cada visita al mapa re-descarga las baldosas Esri (cientos de KB por sesión, lento en 3G).

**Files:**

- Modify: `public/sw.js`

- [ ] **Step 1: Agregar el cache de baldosas**

En `public/sw.js`:

1. Subir la versión (línea 4) para forzar re-instalación:

```js
const VERSION = 'a6-1';
```

2. Debajo de `CACHE_DATOS` agregar:

```js
const CACHE_BALDOSAS = `zelanda-baldosas-${VERSION}`;
const HOSTS_BALDOSAS = ['server.arcgisonline.com', 'elevation-tiles-prod.s3.amazonaws.com'];
const MAX_BALDOSAS = 300;
```

3. En el listener `fetch`, **reemplazar** el bloque `if (url.origin !== self.location.origin) return;` por:

```js
if (url.origin !== self.location.origin) {
  // Baldosas de mapa (satélite/terreno): cache-first con tope.
  if (HOSTS_BALDOSAS.includes(url.hostname)) {
    event.respondWith(cacheBaldosas(req));
  }
  return;
}
```

4. Al final de las funciones helper agregar:

```js
async function cacheBaldosas(req) {
  const cache = await caches.open(CACHE_BALDOSAS);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Las baldosas pueden llegar opacas (no-cors desde <img>); también se cachean.
    if (res.ok || res.type === 'opaque') {
      await cache.put(req, res.clone());
      // Tope FIFO: borrar las más viejas si nos pasamos.
      const claves = await cache.keys();
      if (claves.length > MAX_BALDOSAS) {
        for (const vieja of claves.slice(0, claves.length - MAX_BALDOSAS)) {
          await cache.delete(vieja);
        }
      }
    }
    return res;
  } catch {
    return Response.error();
  }
}
```

Nota: la limpieza del `activate` ya borra caches `zelanda-*` de versiones viejas, incluye este nuevo automáticamente.

- [ ] **Step 2: Verificar**

Run: `npm run dev` → abrir `/jefe/lotes` (el SW solo corre en producción si está registrado así; si el registro es solo prod, probar con `npm run build && npm run start`).

En DevTools → Application → Cache Storage:
Expected: aparece `zelanda-baldosas-a6-1` con entradas de `server.arcgisonline.com`. Segunda visita al mapa: las baldosas salen del cache (Network: "ServiceWorker").

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "perf: cachear baldosas satelitales en el service worker"
```

---

### Task 7: Verificación final de la Fase A

**Files:** ninguno (solo verificación).

- [ ] **Step 1: CI completo**

Run: `npm run ci`
Expected: lint + tests + build, todo verde.

- [ ] **Step 2: Prueba funcional integral (dev o preview)**

Checklist manual con la app corriendo:

1. Login con jefe → llega al panel. Logout → login con un trabajador → llega a su home (los redirects por rol siguen funcionando).
2. `/jefe` → `/jefe/lotes` → tocar polígono → detalle de lote: navegaciones con esqueleto instantáneo y sin recarga completa.
3. Editar polígono de un lote → se refleja en `/jefe/lotes`.
4. Modo avión (con la app ya abierta) → `/trabajador/pendientes` y el dashboard del jefe siguen mostrando datos cacheados.
5. DevTools Network "Slow 4G": medir `/jefe` → `/jefe/lotes` antes/después (comparar contra `main` previo si hace falta). Objetivo: ≥ 50% menos en navegación repetida.

- [ ] **Step 3: Commit final si quedó algo suelto y push**

```bash
git status --short
git push origin main
```

Expected: deploy automático en Vercel. Probar en el celular real con la PWA instalada.
