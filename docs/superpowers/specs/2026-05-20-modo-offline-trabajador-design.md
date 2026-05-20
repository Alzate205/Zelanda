# Modo offline — Sub-fase 5.2a: núcleo + trabajador

**Fecha:** 2026-05-20
**Sub-proyecto de:** Fase 5 (Apicultura y refinamientos)
**Estado:** Diseño aprobado, listo para plan

---

## 1. Objetivo

Que el trabajador pueda **ver sus tareas y registrar avances/novedades sin señal de internet**, y que esos registros se sincronicen automáticamente cuando vuelva la conexión. Es el núcleo de la operación en campo y el caso de uso más crítico de la finca.

Esta sub-fase construye también la **infraestructura común** (Service Worker, IndexedDB, sync engine, idempotencia server-side) que en sub-fases siguientes se extenderá a bodega, almacén y jefe.

Las **fotos quedan fuera** de esta sub-fase. La novedad offline se podrá crear sin foto; la foto se sumará en sub-fase 5.2c.

---

## 2. Decisiones de producto (ya validadas)

| Tema | Decisión |
|---|---|
| Alcance de esta sub-fase | Trabajador: ver tareas, registrar avance (tramo/sueltos/visita), crear novedad sin foto |
| Conflictos al sincronizar | Aceptar ambos sin pelear. No detectamos solape; cada registro es un evento separado |
| Estrategia de sync | Automática (al detectar `online`) + botón manual con badge |
| Errores tras 5 intentos | Pantalla `/trabajador/pendientes` donde el usuario ve qué falló, lo edita o lo borra |
| Feedback offline | Mensaje claro "guardado, sube cuando haya señal" + contador "X pendientes" visible en bottom nav |

---

## 3. Arquitectura

### 3.1 Capas

```
┌─────────────────────────────────────────────────────────┐
│ UI (FormAvance, FormularioNovedad, PaginaTrabajador)    │
│  - useOnlineStatus() hook                                │
│  - useColaPendientes() hook (live count)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Capa de sync (lib/offline/)                              │
│  - enviarConOfflineFallback() — entry point unificado   │
│  - SyncEngine — listener online + retry loop            │
│  - colaDb (IndexedDB)                                    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│ Cache (IndexedDB)    │    │ Queue (IndexedDB)            │
│  cache_asignaciones  │    │  cola_avances                │
│  cache_lotes         │    │  cola_novedades              │
│  cache_tipos_tarea   │    │                              │
│  cache_apiarios      │    │  Cada item:                  │
│  cache_arboles_x_lote│    │   id_local (UUID)            │
│                      │    │   payload                    │
│  Cada uno con TTL    │    │   estado (pendiente/sub.)    │
│  y timestamp.        │    │   intentos, ultimo_error     │
└──────────────────────┘    └──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Server (API routes idempotentes)                         │
│  POST /api/trabajador/avance      (body con id_local)   │
│  POST /api/trabajador/novedad     (body con id_local)   │
│  GET  /api/trabajador/snapshot    (priming de cache)    │
│  - Deduplican por id_local                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Flujo: registrar avance offline

1. Trabajador llena el form de avance.
2. Al submit, en vez de `useActionState` con server action, el form llama `enviarConOfflineFallback("avance", payload)`.
3. La función genera un `id_local` (UUID v4), guarda el item en `cola_avances` con estado `pendiente`, e **intenta** POST a `/api/trabajador/avance` con el `id_local` en el body.
4. **Si el POST tiene éxito**: marca el item como `subido` y lo borra de la cola tras 5 segundos (deja rastro breve para feedback). Server actualiza BD.
5. **Si el POST falla** (offline, timeout, 5xx): el item queda en `pendiente`. SyncEngine lo reintenta luego.
6. UI muestra mensaje:
   - Online success: "Avance registrado" (verde, autodismiss 2s).
   - Offline: "Guardado · sube cuando haya señal" (ámbar, autodismiss 4s).
7. El badge "X pendientes" en bottom nav se actualiza vía hook `useColaPendientes()`.

### 3.3 Flujo: sync automática

SyncEngine corre como singleton client-side:

- Al cargar la app (si online), procesa cola.
- Listener `window.addEventListener("online", ...)` → procesa cola.
- Cada item: `POST` con su `id_local`. Si éxito → borra. Si fallo → incrementa `intentos`, calcula próximo backoff (1s, 5s, 30s, 5min, abandono a `error_permanente` tras 5 intentos).
- Loop reintenta hasta que cola está vacía o todos los items están en `error_permanente`.
- **No corre en background si la app no está abierta** (Background Sync API queda opcional, fuera de scope para 5.2a por compatibilidad iOS).

### 3.4 Idempotencia server-side

Cada endpoint POST acepta un campo `id_local` (UUID v4) en el body. El server:

1. Mira si ya existe un registro con ese `id_local` en la tabla correspondiente.
2. Si **existe**: retorna 200 OK con el registro ya guardado (idempotente, no crea duplicado).
3. Si **no existe**: crea el registro guardando el `id_local`, retorna 201 Created.

Para esto se agrega columna `id_local UUID NULL UNIQUE` a:
- `registros_avance`
- `novedades`
- (Más adelante: `cosechas`, `salidas_almacen`, `despachos`, `asignaciones`.)

Migración en `supabase/migracion-fase5-offline-trabajador.sql`.

### 3.5 Cache priming

Al login del trabajador, si hay señal, dispara `GET /api/trabajador/snapshot` que devuelve:

```json
{
  "asignaciones": [...],
  "lotes": [...],   // solo los que aparecen en asignaciones + para novedad
  "apiarios": [...], // solo los que aparecen en asignaciones
  "tipos_tarea": [...],
  "personas_self": {...},
  "ts": "2026-05-20T..."
}
```

Esto se guarda en IndexedDB. Las pantallas del trabajador (`/trabajador`, `/trabajador/avance/[id]`, `/trabajador/novedad/nueva`) leen **primero del cache**, y si hay señal hacen revalidación en background.

> **Decisión técnica**: las pantallas del trabajador se convierten de Server Component (que requiere señal) a Client Component que lee de IndexedDB. La carga inicial (sin cache) muestra spinner y dispara fetch.

### 3.6 Service Worker

El `public/sw.js` actual solo maneja push. Se extiende con:

- **App shell**: cache de rutas estáticas, JS, CSS (cache-first con stale-while-revalidate).
- **Navegación offline**: si el usuario navega a `/trabajador` sin señal, el SW sirve la página cacheada en vez de mostrar el error de Next.js.
- **Estrategia por ruta**:
  - `/trabajador/*` → cache-first con SWR.
  - `/api/trabajador/snapshot` → network-first (cache fallback).
  - `/api/trabajador/avance` y `/api/trabajador/novedad` → **no cachear** (deben fallar limpio para que la UI los queue).

### 3.7 Pantalla de pendientes

Nueva ruta: `/trabajador/pendientes`. Lista items en cola con:

- Resumen (tipo + lote + cantidad + fecha local de creación).
- Estado (pendiente / subiendo / error permanente).
- Si error permanente: muestra `ultimo_error` y botones **Reintentar** / **Borrar**.
- Si pendiente: solo informativo.
- Si subiendo: indicador animado.

Badge en bottom nav del trabajador con número total de items en `pendiente` o `error_permanente` (no cuenta los `subido` que ya se borraron).

---

## 4. Modelo de datos local (IndexedDB)

DB name: `zelanda-offline-v1`. Versión 1.

### 4.1 Object stores

**`cache_asignaciones`** (keyPath: `id`)
```ts
{
  id: string,                 // BigInt como string
  persona_id: string,
  tipo_tarea_id: string,
  tipo_tarea_nombre: string,
  tipo_tarea_area: "CULTIVO" | "APICULTURA",
  lote_id: string | null,
  lote_nombre: string | null,
  total_arboles: number | null,
  arboles_completados: number,
  ultimo_arbol_trabajado: number,
  apiario_id: string | null,
  apiario_nombre: string | null,
  total_colmenas: number | null,
  estado: "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | ...,
  fecha_inicio: string,       // ISO
  ts_cache: number            // Date.now() del último fetch
}
```

**`cache_lotes`** (keyPath: `id`)
```ts
{ id, nombre, total_arboles, ts_cache }
```

**`cache_meta`** (keyPath: `key`)
```ts
{ key: "snapshot_ts", value: 1716198400000 }
```

**`cola_avances`** (keyPath: `id_local`)
```ts
{
  id_local: string,         // UUID v4
  asignacion_id: string,
  tipo_registro: "TRAMO" | "SUELTOS" | "VISITA",
  arbol_desde: number | null,
  arbol_hasta: number | null,
  arboles_lista: number[],
  observaciones: string | null,
  estado: "pendiente" | "subiendo" | "subido" | "error_permanente",
  intentos: number,
  ultimo_error: string | null,
  creado_en: number,        // Date.now()
}
```
Índice: `estado`.

**`cola_novedades`** (keyPath: `id_local`)
```ts
{
  id_local: string,
  lote_id: string,
  numero_placa: number,
  tipo: "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO",
  descripcion: string,
  estado: "pendiente" | "subiendo" | "subido" | "error_permanente",
  intentos: number,
  ultimo_error: string | null,
  creado_en: number,
}
```
Índice: `estado`.

### 4.2 Política de limpieza

- Cache se considera **fresca** durante 5 minutos. Más allá, se revalida en background al abrir la pantalla.
- Items de cola en estado `subido` se borran a los 5 segundos.
- Items en `error_permanente` quedan hasta que el usuario los borre o reintente.

---

## 5. Cambios en archivos

### 5.1 Crear

| Archivo | Responsabilidad |
|---|---|
| `lib/offline/db.ts` | Wrapper de `idb` que abre la DB, define schema, expone `getDb()` |
| `lib/offline/cache.ts` | `guardarSnapshot(data)`, `leerAsignaciones()`, `leerLotes()`, `leerAsignacion(id)` |
| `lib/offline/cola.ts` | `encolarAvance(p)`, `encolarNovedad(p)`, `listarPendientes()`, `borrarItem(id_local)`, `marcarSubido(id_local)`, `marcarError(id_local, err)` |
| `lib/offline/sync.ts` | `SyncEngine` singleton: `init()`, `procesarCola()`, listener `online`, backoff |
| `lib/offline/api-cliente.ts` | `enviarConOfflineFallback("avance" \| "novedad", payload)` con la lógica de "intentar y caer a cola" |
| `lib/offline/uuid.ts` | `generarUuid()` — wrapper de `crypto.randomUUID()` con fallback |
| `hooks/useOnlineStatus.ts` | Hook con `online: boolean` reactivo |
| `hooks/useColaPendientes.ts` | Hook con `total: number` (suma de pendientes+error_permanente). Re-evalúa cada vez que la cola cambia (event emitter en `lib/offline/sync.ts`) |
| `components/shared/BannerOffline.tsx` | Banner discreto en bottom nav del trabajador con badge contador |
| `components/shared/IndicadorPendientes.tsx` | Componente reusable que muestra "X pendientes" + link a `/trabajador/pendientes` |
| `app/api/trabajador/snapshot/route.ts` | GET: devuelve datos para priming del trabajador autenticado |
| `app/api/trabajador/avance/route.ts` | POST: idempotente por `id_local`, lógica de `acciones.ts` actual |
| `app/api/trabajador/novedad/route.ts` | POST: idempotente por `id_local`, lógica de `acciones.ts` actual (sin foto en esta fase) |
| `app/(app)/trabajador/pendientes/page.tsx` | Lista de items en cola (client component) |
| `app/(app)/trabajador/pendientes/_lista.tsx` | UI de items con acciones reintentar/borrar |
| `supabase/migracion-fase5-offline-trabajador.sql` | Agrega columna `id_local UUID UNIQUE` a `registros_avance` y `novedades` |

### 5.2 Modificar

| Archivo | Cambio |
|---|---|
| `public/sw.js` | Agregar cache de app shell, estrategias por ruta, navegación offline |
| `app/(app)/trabajador/page.tsx` | Convertir a Client Component que lee de IndexedDB con fallback a fetch. Inicialmente Server Component que también dispara cache priming |
| `app/(app)/trabajador/avance/[asignacion_id]/page.tsx` | Igual: client component que lee de cache |
| `app/(app)/trabajador/avance/[asignacion_id]/FormAvance.tsx` | Reemplazar `useActionState` con `enviarConOfflineFallback` |
| `app/(app)/trabajador/novedad/nueva/page.tsx` | Client component leyendo cache |
| `app/(app)/trabajador/novedad/nueva/FormularioNovedad.tsx` | Reemplazar `useActionState` con `enviarConOfflineFallback`. Campo foto solo visible online |
| `app/(app)/layout.tsx` | Montar `<BannerOffline>` y `<SyncEngineInit>` para todos los layouts |
| `prisma/schema.prisma` | Reflejar `id_local UUID UNIQUE` en `registros_avance` y `novedades` |

### 5.3 No tocar (en esta sub-fase)

- `app/(app)/jefe/**` — quedan online-only por ahora.
- `app/(app)/bodega/**` — online-only.
- `app/(app)/almacen/**` — online-only.
- `components/shared/BottomNav.tsx` — sin cambios; los pendientes se muestran como **pill flotante** sobre el bottom nav, no como item adicional.
- Fotos en `components/shared/SubirFoto.tsx` — sigue igual. En el `FormularioNovedad` se condiciona la visibilidad del campo: si offline, el campo no se renderiza y se muestra un texto "Foto disponible solo con señal". Si online, comportamiento actual.

---

## 6. Diseño detallado de componentes clave

### 6.1 `lib/offline/api-cliente.ts`

```ts
type Tipo = "avance" | "novedad";
type Payload = AvancePayload | NovedadPayload;

export async function enviarConOfflineFallback<T extends Payload>(
  tipo: Tipo,
  payload: T,
): Promise<{ ok: true; offline: boolean; id_local: string } | { ok: false; error: string }> {
  const id_local = generarUuid();
  const item = { id_local, ...payload, estado: "pendiente", intentos: 0, ultimo_error: null, creado_en: Date.now() };

  if (tipo === "avance") await encolarAvance(item);
  else await encolarNovedad(item);

  if (!navigator.onLine) {
    return { ok: true, offline: true, id_local };
  }

  // Intentar subida inmediata
  try {
    const res = await fetch(`/api/trabajador/${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id_local }),
    });
    if (!res.ok) {
      // 4xx: marcar error permanente; 5xx: dejar pendiente
      if (res.status >= 400 && res.status < 500) {
        const j = await res.json().catch(() => ({}));
        await marcarErrorPermanente(tipo, id_local, j.error ?? `HTTP ${res.status}`);
        return { ok: false, error: j.error ?? "Validación falló" };
      }
      return { ok: true, offline: true, id_local }; // server problem; lo retomamos
    }
    await marcarSubido(tipo, id_local);
    return { ok: true, offline: false, id_local };
  } catch {
    // Error de red. Lo deja en cola.
    return { ok: true, offline: true, id_local };
  }
}
```

### 6.2 `lib/offline/sync.ts`

```ts
class SyncEngineImpl {
  private corriendo = false;

  init() {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => this.procesarCola());
    this.procesarCola(); // intento inicial
  }

  async procesarCola() {
    if (this.corriendo || !navigator.onLine) return;
    this.corriendo = true;
    try {
      for (const tipo of ["avance", "novedad"] as const) {
        const pendientes = await listarPendientesPorTipo(tipo);
        for (const item of pendientes) {
          if (item.intentos >= 5) {
            await marcarErrorPermanente(tipo, item.id_local, item.ultimo_error ?? "Máx reintentos");
            continue;
          }
          await marcarSubiendo(tipo, item.id_local);
          try {
            const res = await fetch(`/api/trabajador/${tipo}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(itemAPayload(item)),
            });
            if (res.ok) {
              await marcarSubido(tipo, item.id_local);
              emitirCambio();
            } else if (res.status >= 400 && res.status < 500) {
              const j = await res.json().catch(() => ({}));
              await marcarErrorPermanente(tipo, item.id_local, j.error ?? `HTTP ${res.status}`);
              emitirCambio();
            } else {
              await marcarFallidoTemp(tipo, item.id_local, `HTTP ${res.status}`);
              await esperar(backoff(item.intentos));
            }
          } catch (e) {
            await marcarFallidoTemp(tipo, item.id_local, (e as Error).message);
            await esperar(backoff(item.intentos));
            if (!navigator.onLine) break;
          }
        }
      }
    } finally {
      this.corriendo = false;
    }
  }
}

export const SyncEngine = new SyncEngineImpl();

function backoff(intentos: number): number {
  return [1000, 5000, 30000, 300000][Math.min(intentos, 3)];
}
```

### 6.3 Pill flotante de pendientes

En vez de tocar el bottom nav (que tiene items finos y se llena rápido), se monta un componente `<BannerOffline>` en el layout `(app)/layout.tsx` que aparece **solo cuando hay items pendientes o el dispositivo está offline**:

- Posición: `fixed` arriba del bottom nav (bottom ≈ 76px).
- Color: ámbar suave cuando offline; verde si online sincronizando; rojo si hay items en `error_permanente`.
- Texto: "3 pendientes · Sin señal" / "Sincronizando…" / "1 error".
- Click → `/trabajador/pendientes`.
- Auto-oculto cuando todo está sincronizado y online.

Esto evita modificar `BottomNav.tsx` y aplica también a los demás roles cuando se extienda en sub-fases siguientes.

---

## 7. Manejo de bigint y serialización

Prisma maneja `BigInt`. Para que pase por JSON necesitamos siempre serializar como string. Esto ya pasa en el snapshot endpoint y en las APIs. La columna `id_local` es UUID, no BigInt.

---

## 8. Migración SQL

```sql
-- supabase/migracion-fase5-offline-trabajador.sql

ALTER TABLE registros_avance
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_registros_avance_id_local
  ON registros_avance(id_local) WHERE id_local IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_novedades_id_local
  ON novedades(id_local) WHERE id_local IS NOT NULL;
```

---

## 9. Pruebas

Probar en condiciones reales:

1. **Cache priming**: login con señal → ver que IndexedDB se llene → cortar Wi-Fi → entrar a `/trabajador` y verificar que se ven tareas.
2. **Avance offline**: cortar Wi-Fi → registrar TRAMO → confirmar feedback "guardado, sube luego" → ver badge "1 pendientes" → reconectar Wi-Fi → ver badge ir a 0 → recargar y confirmar avance en BD.
3. **Avance online**: registrar normal → ver feedback "registrado" → confirmar en BD.
4. **Doble submit accidental**: registrar mismo avance dos veces (mismo id_local en ambos POSTs) → confirmar que solo se crea una vez.
5. **Validación falla**: enviar avance con datos inválidos (ej. tramo fuera de rango) → confirmar que pasa a `error_permanente` → confirmar que aparece en `/trabajador/pendientes`.
6. **Borrar item con error**: desde `/trabajador/pendientes`, borrar → confirmar que el badge baja.
7. **Cierre de app con cola**: registrar offline → cerrar app → abrir app → confirmar que la cola persiste y se sincroniza.
8. **PWA standalone offline**: instalar PWA → cortar señal → abrir desde icono → confirmar que la app carga (no es Safari error).
9. **iOS standalone**: lo mismo en iOS instalada (sin barra de Safari).

---

## 10. Lo que queda fuera (sub-fases siguientes)

- **5.2b**: Bodega (despachos, devolución), almacén (cosecha, salida), jefe (asignaciones, edición lotes/personas) offline.
- **5.2c**: Fotos offline con re-escalado a 1280px, blob a IndexedDB, sync a Supabase Storage.

---

## 11. Notas técnicas

- **Lib elegida**: `idb` (~1KB) en vez de Dexie (~30KB). Razón: solo necesitamos un wrapper fino sobre IndexedDB; Dexie aporta queries que no vamos a usar.
- **PWA y Server Components**: las pantallas del trabajador deben funcionar offline, por eso pasan de Server Components a Client Components. La inversión de paradigma es OK porque son pocas pantallas.
- **iOS y Background Sync**: la Background Sync API no funciona en iOS Safari. No la usamos; toda sync depende de que la app esté abierta. Aceptable porque los trabajadores usan la app activamente en campo.
- **Service Worker actualizable**: cada deploy invalida el cache del SW por bump de versión hardcodeada en `sw.js` (`const VERSION = "5.2a"`). Al activar nueva versión, limpia caches viejos.
