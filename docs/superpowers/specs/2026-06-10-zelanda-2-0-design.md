# Zelanda 2.0 — Velocidad + Centro de Control 3D + Funciones novedosas

**Fecha:** 2026-06-10
**Estado:** Aprobado por Samuel (brainstorming con companion visual)
**Decisiones del usuario:** mapa = esencia de la app · estética futurista pero práctica · 3D con plan B de rendimiento · solo rol JEFE recibe el centro de control · funciones nuevas elegidas: clima, NDVI, vuelo de dron, máquina del tiempo, predicción de cosecha.

---

## 1. Diagnóstico de velocidad (qué está lento y por qué)

| #   | Problema                                     | Evidencia                                                                                                                                                                                             | Impacto                                                                          |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Triple verificación de sesión por navegación | `middleware.ts` llama `supabase.auth.getUser()` (red); `app/(app)/layout.tsx` llama `requerirUsuario()` (red ×2: auth + tabla `usuarios`); cada página llama `requerirUsuario(rol)` otra vez (red ×2) | 3–5 viajes en serie a Supabase antes de cargar datos. ~400–800 ms por navegación |
| 2   | El mapa recarga la app entera                | `MapaFinca.tsx:187` usa `window.location.href` en el click del polígono                                                                                                                               | Pierde todo el estado de React, re-descarga el bundle, re-autentica              |
| 3   | Logo de 1.2 MB                               | `public/logo-zelanda.png` (1.209.941 bytes) usado en login/splash                                                                                                                                     | Varios segundos en 3G rural                                                      |
| 4   | Navegaciones "en blanco"                     | No hay `loading.tsx` en las rutas; el servidor responde todo o nada                                                                                                                                   | Sensación de lentitud aunque el servidor tarde igual                             |
| 5   | Datos casi estáticos consultados siempre     | Polígonos/puntos geo (`/jefe/lotes`), catálogos                                                                                                                                                       | Queries PostGIS repetidas en cada visita                                         |
| 6   | Baldosas del satélite sin cache              | `sw.js` solo cachea mismo origen (`url.origin !== self.location.origin` ⇒ return)                                                                                                                     | El mapa re-descarga las baldosas Esri cada vez; gasta datos                      |

## 2. Fase A — Velocidad (sin cambiar ninguna funcionalidad)

### A1. Autenticación: de 5 viajes a ~1

- Envolver `obtenerUsuarioActual()` en `cache()` de React (`lib/auth.ts`): layout + página comparten **una** verificación por petición.
- Dentro de `obtenerUsuarioActual()`, validar el JWT localmente (`supabase.auth.getClaims()`, disponible en `@supabase/supabase-js` 2.105) en lugar de `getUser()` (que viaja a Supabase). El refresh del token sigue siendo responsabilidad del middleware, que ya lo hace.
- La consulta a la tabla `usuarios` se mantiene (trae rol/activo) pero ocurre una sola vez por petición gracias al `cache()`.
- **Seguridad sin cambios:** el token sigue firmado por Supabase y verificado; RLS sigue activa en cada query.

### A2. Navegación del mapa sin recarga

- `MapaFinca.tsx`: reemplazar `window.location.href` por `router.push()` (`useRouter` de `next/navigation`).

### A3. Activos pesados

- Convertir `logo-zelanda.png` / `logo.png` a WebP (≤ 60 KB, lado mayor 800 px) y servir con `next/image`.
- En `next.config.ts`: migrar `images.domains` (deprecado) a `remotePatterns` y habilitar `formats: ['image/avif', 'image/webp']`.

### A4. Esqueletos de carga + streaming

- `loading.tsx` con esqueletos (mismas cards/heroes grises animados) para: `(app)/jefe`, `jefe/lotes`, `jefe/lotes/[id]`, `jefe/saldos`, `jefe/reportes`, y los homes de bodega/almacén/trabajador.
- Donde una página tenga una consulta dominante lenta, partirla con `<Suspense>` para que el marco pinte primero.

### A5. Cache de lecturas casi estáticas

- Las 4 queries geo de `/jefe/lotes` (lotes, apiarios, instalaciones, borde finca) → `unstable_cache` con tag `geo-finca`, `revalidate: 3600`.
- `revalidateTag('geo-finca')` en las server actions que editan polígonos/puntos (`lib/acciones-mapa.ts` y formularios de ubicación).
- Catálogos (`tipos_tarea`, etc.) → mismo patrón con tags propios donde se consulten en caliente.

### A6. Cache de baldosas en el service worker

- `sw.js`: permitir cache-first para orígenes de baldosas (`server.arcgisonline.com`, `elevation-tiles-prod.s3.amazonaws.com`) en un cache `zelanda-tiles` con tope (~300 entradas, purga FIFO).

### Verificación de Fase A

- `npm run ci` (lint + vitest + build) verde.
- Medición manual antes/después: tiempo de navegación entre `/jefe` → `/jefe/lotes` → detalle de lote (DevTools, red "Slow 4G"). Objetivo: ≥ 50% menos en navegaciones repetidas.
- Login, roles, offline (pantallas `/pendientes`) siguen funcionando igual.

## 3. Fase B — Centro de control 3D (nueva pantalla principal del JEFE)

### Concepto

El jefe abre la app y aterriza en un **mapa 3D a pantalla completa** con el relieve real de la montaña. Es el reemplazo del dashboard como home (`/jefe`), con toda la información del dashboard actual accesible desde el propio mapa. Los demás roles no cambian.

### Stack del mapa

- **Motor:** `maplibre-gl` (nueva dependencia, aprobada). Carga dinámica `ssr:false` solo en `/jefe` — el resto de la app no paga su peso.
- **Satélite:** raster Esri World Imagery (el actual).
- **Terreno 3D:** raster-DEM gratuito de AWS Terrain Tiles, encoding `terrarium`: `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`. Exageración ~1.3, pitch inicial ~50°.
- **Leaflet se conserva** para: editores de polígonos/puntos existentes (no se tocan) y como **plan B** si el dispositivo no soporta WebGL (detección al montar; si falla, se renderiza el `MapaFinca` Leaflet actual con los mismos datos).

### Estructura de componentes (nuevos, en `components/mapa3d/`)

| Componente          | Responsabilidad                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CentroControl.tsx` | Orquestador client-side: estado de modo de vista, lote seleccionado, paneles                                                  |
| `Mapa3D.tsx`        | MapLibre: fuentes, capas, terreno, cámara, eventos. Expone `volarA(lote)`                                                     |
| `PanelLote.tsx`     | Bottom sheet al tocar un lote: estado de tareas, novedades, kg del mes, botones "Ver lote" / "Asignar tarea" (links prefetch) |
| `DockKPIs.tsx`      | Dock inferior de vidrio: al día / próximas / vencidas / kg mes                                                                |
| `ChipsModos.tsx`    | Chips de modo: Tareas · Cosecha · Equipo · Clima (clima se activa en Fase C3)                                                 |
| `PanelCentral.tsx`  | Panel deslizable con el contenido del dashboard actual (alertas, recordatorios, novedades, atajos) — nada se pierde           |
| `BotonGPS.tsx`      | Geolocalización con marcador propio y re-centrado                                                                             |

### Datos

- `/jefe/page.tsx` (server) entrega: snapshot existente (`construirSnapshotJefe`, cacheado 30 s) + geo cacheado (tag `geo-finca`).
- **Extensión del snapshot:** agregar `lotes_estado: { lote_id, estado: 'aldia'|'proxima'|'vencida' }[]` (ya se calcula internamente en `lib/jefe/snapshot.ts`, solo hay que exponerlo) y `cosecha_mes_por_lote: { lote_id, kg }[]` para el modo Cosecha.
- Modo Equipo: asignaciones `EN_CURSO`/`PENDIENTE` de hoy con persona y lote (se agrega al snapshot).
- Offline: el SW ya cachea `/api/jefe/snapshot` network-first; el HTML de `/jefe` ya se cachea. Las baldosas quedan en `zelanda-tiles` (A6). El centro de control abre offline con datos del último sync.

### Estética (estilo "premium claro" elegido)

- Paneles `backdrop-blur` translúcidos beige sobre el satélite, bordes blancos suaves, sombras `shadow-suave`, serif en títulos.
- Semáforo: relleno del polígono según estado (verde `#4e7d57` / ámbar `#c89045` / rojo `#b05642`), borde blanco; el vencido con animación de pulso sutil (opacity loop).
- Tocar lote → `flyTo` cinematográfico (~1.2 s) + bottom sheet.
- Etiquetas de lote como `symbol` layers con halo, visibles según zoom.

### Rutas

- `/jefe` → centro de control (nuevo).
- `/jefe/lotes` → se mantiene como lista/leyenda (sin el mapa Leaflet grande; link "Abrir mapa" → `/jefe`).
- Todo lo demás intacto.

### Verificación de Fase B

- Playwright smoke: `/jefe` monta el mapa, tocar lote abre panel, "Ver lote" navega.
- Prueba manual en celular real (Android gama media) — fluidez de pitch/rotación.
- Prueba sin WebGL (Chrome `--disable-webgl`) → cae a Leaflet.
- Offline: avión + reload → mapa con baldosas cacheadas y snapshot viejo.

## 4. Fase C — Funciones novedosas (orden de implementación)

### C1. Vuelo de dron

- Botón en el centro de control: la cámara recorre los 15 lotes (orden por cercanía geográfica, ruta calculada con los centroides) con `flyTo` encadenados; overlay con nombre + dato clave del lote en cada parada. Botón salir/pausar. Sin dependencias nuevas.

### C2. Máquina del tiempo

- Slider temporal (mes a mes desde el primer dato) en un modo "Historia": pinta los lotes según kg cosechados del mes seleccionado y muestra contadores del mes (tareas completadas, novedades). Endpoint `/api/jefe/historia?mes=` con `unstable_cache` por mes (datos históricos: cache larga). Sin dependencias nuevas.

### C3. Clima por lote + alertas agro

- **Fuente:** Open-Meteo (gratis, sin API key). Una llamada por finca (centroide) con hourly: precipitación, temperatura, viento, y daily 7 días.
- `lib/clima.ts`: fetch + parseo + reglas agro (`ventana_fumigacion: boolean` si no llueve en las próximas N horas; `riesgo_helada` si min < umbral).
- Modo Clima en el mapa: panel con pronóstico 7 días + indicadores sobre los lotes.
- Alertas push: nuevo cron Vercel (7 am Colombia, junto al existente) que evalúa reglas y empuja "Llueve esta tarde — no programes fumigación" / "Riesgo de helada esta noche". Cache del pronóstico 30 min (`unstable_cache`).

### C4. Predicción de cosecha

- `lib/prediccion-cosecha.ts` (puro, testeado con vitest): por lote, usa histórico de `cosechas` para estimar kg del ciclo en curso — media móvil ponderada por ciclo + tendencia lineal simple. Devuelve rango (pesimista/esperado/optimista) y confianza según cantidad de datos.
- UI: card en `PanelLote` + sección en reportes avanzados. Sin dependencias nuevas.

### C5. NDVI satelital (la más compleja — va última)

- **Fuente:** Copernicus Data Space Ecosystem (cuenta gratuita; Sentinel-2 L2A, revisita ~5 días). Vía Process API de Sentinel Hub (incluida en el free tier de CDSE) se solicita un PNG de NDVI recortado al bounding box de la finca.
- Server route `/api/jefe/ndvi` que pide la imagen, la guarda en Supabase Storage con fecha, y la sirve cacheada (revalidación semanal). El mapa la superpone como `image source` georreferenciada con slider de opacidad.
- Requiere secretos nuevos: `CDSE_CLIENT_ID` / `CDSE_CLIENT_SECRET` (Samuel crea la cuenta cuando lleguemos acá).
- Si la API falla o no hay imagen reciente sin nubes: la capa se desactiva con un aviso, nunca rompe el mapa.

## 5. Manejo de errores (transversal)

- Baldosas que fallan: MapLibre reintenta solo; sin red usa cache del SW.
- Open-Meteo caído: modo Clima muestra "Pronóstico no disponible" con el último dato cacheado y su hora.
- WebGL no disponible: fallback Leaflet automático (sin mensaje de error al usuario).
- Todas las APIs nuevas responden `{ ok, data | error }` como el resto del proyecto.

## 6. Qué NO cambia

- Roles trabajador/bodega/almacén: pantallas, flujos y offline intactos.
- Esquema de BD: **cero migraciones** en fases A–C4 (C5 tampoco toca la BD; usa Storage).
- Editores de polígonos/puntos (Leaflet) intactos.
- RLS, auth, push, crons existentes intactos.

## 7. Orden y entregables

A (velocidad) → B (centro de control 3D) → C1 (dron) → C2 (historia) → C3 (clima) → C4 (predicción) → C5 (NDVI).
Cada fase termina con `npm run ci` verde, prueba manual en celular y deploy a Vercel antes de empezar la siguiente.
