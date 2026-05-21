# Modo offline — Sub-fase 5.2b: bodega + almacén + jefe (lectura)

**Fecha:** 2026-05-20
**Sub-proyecto de:** Fase 5 (Apicultura y refinamientos)
**Continuación de:** sub-fase 5.2a (núcleo + trabajador, ya entregada)

---

## 1. Objetivo

Extender el modo offline a **bodega**, **almacén** y **jefe**, reutilizando la infraestructura ya construida en 5.2a (`lib/offline/`, sync engine, banner, cola, idempotencia).

Realidad operacional (validada con el usuario): en la casa principal hay señal estable; en lotes lejanos no. Esto significa que:
- Bodega y almacén **suelen** estar con señal pero necesitan resiliencia ante caídas puntuales.
- El jefe va al campo a supervisar y necesita **leer** datos sin señal.

## 2. Decisiones de producto (validadas)

| Tema | Decisión |
|---|---|
| Bodega offline | Crear despacho + cerrar despacho (devolución + consumo) |
| Almacén offline | Crear cosecha + crear salida |
| Jefe offline | **Solo lectura**: lotes, asignaciones, novedades, alertas. Sin crear/editar |
| TTL cache jefe | Sin TTL estricto. Mostrar timestamp "actualizado hace X" para que el jefe sepa cuán reciente |
| Conflictos | Servidor valida al sincronizar. Si stock insuficiente / lote inválido → item pasa a `error_permanente`, usuario decide |
| Idempotencia | `id_local UUID UNIQUE` en `despachos`, `cosechas`, `salidas_cosecha` |

## 3. Arquitectura

### 3.1 Reutilización de 5.2a

Todo lo del lib/offline ya existe:
- `db.ts`: extender schema bumpeando a versión 2
- `cache.ts`: agregar funciones para bodega/almacén/jefe
- `cola.ts`: agregar 4 tipos de cola
- `sync.ts`: extender `procesarTipo` para los nuevos tipos
- `api-cliente.ts`: agregar `enviarDespachoCrear`, `enviarDespachoCerrar`, `enviarCosecha`, `enviarSalida`
- `tipos.ts`: agregar tipos
- `BannerOffline.tsx`, hooks: sin cambios (ya cuentan items de cualquier tipo)

### 3.2 Nuevos stores de IndexedDB (versión 2)

**Cache (snapshots por rol):**
- `cache_bodega` (keyPath: "key", único item con `key: "snapshot"`): herramientas[], insumos[], despachos_abiertos[]
- `cache_almacen` (keyPath: "key"): lotes[], personas[], stock_almacen, ts_cache
- `cache_jefe` (keyPath: "key"): lotes[], asignaciones[], novedades[], alertas, ts_cache

**Colas:**
- `cola_despachos_crear` (keyPath: `id_local`, índice `por_estado`)
- `cola_despachos_cerrar` (keyPath: `id_local`, índice `por_estado`)
- `cola_cosechas` (keyPath: `id_local`, índice `por_estado`)
- `cola_salidas` (keyPath: `id_local`, índice `por_estado`)

### 3.3 Migración SQL

```sql
ALTER TABLE despachos ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE cosechas ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE salidas_cosecha ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_despachos_id_local ON despachos(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cosechas_id_local ON cosechas(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_salidas_cosecha_id_local ON salidas_cosecha(id_local) WHERE id_local IS NOT NULL;
```

### 3.4 APIs nuevos (todos idempotentes por `id_local`)

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/bodega/snapshot` | Herramientas activas + insumos con stocks + despachos abiertos del bodeguero (con items) |
| POST | `/api/bodega/despacho/crear` | Crear despacho con items, validar stock, descontar reserva, crear movimientos |
| POST | `/api/bodega/despacho/cerrar` | Cerrar despacho, actualizar items con consumo/devolución, actualizar stocks |
| GET | `/api/almacen/snapshot` | Lotes con árboles + personas activas + stock actual del almacén |
| POST | `/api/almacen/cosecha` | Crear cosecha idempotente |
| POST | `/api/almacen/salida` | Crear salida idempotente, validar stock |
| GET | `/api/jefe/snapshot` | Lotes (resumen+estado), asignaciones activas, novedades no resueltas, alertas |

### 3.5 Cómo se sienten los conflictos

- **Stock insuficiente al sincronizar**: API retorna 409, item pasa a `error_permanente`. UI en `/bodega/pendientes` (o `/almacen/pendientes`) muestra el error.
- **Despacho ya cerrado por otro bodeguero**: API retorna 409 en `cerrar`, error_permanente.
- **Lote eliminado entre cache y sync**: API retorna 404, error_permanente.

### 3.6 UX

- **Banner offline** ya existe. Sigue mostrando contador total de pendientes de cualquier rol.
- **Botones de submit** en formularios cambian de "Crear despacho" a "Crear despacho · sube luego" cuando offline.
- **Páginas del jefe**: convertir Server Components que listan datos a Server Component que también sirve snapshot inicial, más Client Component que lee del cache. En `online`, revalida en background.
- **Pantalla `/bodega/pendientes`** y `/almacen/pendientes`: similar a `/trabajador/pendientes`. Listan items en cola, permiten reintentar/borrar errores.

## 4. Alcance y exclusiones

**Incluido en 5.2b:**
- Despachos: crear y cerrar
- Cosechas: crear
- Salidas: crear
- Jefe: ver lotes, asignaciones, novedades, alertas
- Pantallas `/bodega/pendientes` y `/almacen/pendientes`

**Fuera de scope (sub-fases siguientes o quedan online):**
- Crear/editar herramientas e insumos (catálogos online)
- Ingresar stock manual de insumo (online)
- Ajustes manuales de stock (online)
- Jefe: crear/editar asignaciones, lotes, personas, novedades, etc.
- Fotos offline (sub-fase 5.2c)

## 5. Cambios en archivos (resumen)

**Crear:**
- `supabase/migracion-fase5-offline-bodega-almacen.sql`
- `app/api/bodega/snapshot/route.ts`
- `app/api/bodega/despacho/crear/route.ts`
- `app/api/bodega/despacho/cerrar/route.ts`
- `app/api/almacen/snapshot/route.ts`
- `app/api/almacen/cosecha/route.ts`
- `app/api/almacen/salida/route.ts`
- `app/api/jefe/snapshot/route.ts`
- `app/(app)/bodega/pendientes/page.tsx` + `_lista-cliente.tsx`
- `app/(app)/almacen/pendientes/page.tsx` + `_lista-cliente.tsx`

**Modificar:**
- `lib/offline/tipos.ts` (agregar tipos bodega/almacén/jefe)
- `lib/offline/db.ts` (versión 2, nuevos stores)
- `lib/offline/cache.ts` (funciones para nuevos roles)
- `lib/offline/cola.ts` (4 nuevos tipos)
- `lib/offline/sync.ts` (procesar nuevos tipos)
- `lib/offline/api-cliente.ts` (4 nuevos `enviar*`)
- `prisma/schema.prisma` (id_local en 3 modelos)
- Formularios:
  - `app/(app)/bodega/despachos/nuevo/_formulario.tsx`
  - `app/(app)/bodega/despachos/[id]/_formulario.tsx`
  - `app/(app)/almacen/cosecha/nueva/_formulario.tsx`
  - `app/(app)/almacen/salidas/nueva/_formulario.tsx`
- Páginas que cargan datos del jefe (lotes, asignaciones, novedades, alertas) → convertir a leer cache cuando offline

## 6. Pruebas (smoke)

Por cada flujo:
1. Online: ejecutar acción normalmente, verificar BD.
2. Cortar Wi-Fi, ejecutar, verificar item en cola y banner contador.
3. Reconectar, verificar sync automática, verificar BD.
4. Idempotencia: simular doble-submit, verificar no-duplicado.
5. Conflicto: provocar 409 (stock insuficiente), verificar `error_permanente` + UI de pendientes.
6. Jefe: ir a `/jefe`, cortar Wi-Fi, recargar, verificar que se ven datos cacheados con timestamp.

## 7. Notas técnicas

- **DB upgrade**: pasar de versión 1 a 2. El callback `upgrade(db, oldVersion)` debe crear los nuevos stores sin tocar los existentes.
- **Single-object snapshots vs múltiples stores**: para bodega/almacén/jefe usamos snapshot único por rol (un object store con un solo item de clave "snapshot"). Más simple que múltiples stores y suficiente porque el volumen es chico.
- **Push de stock-bajo**: la lógica actual en `notificarStockBajoSiCorresponde` corre server-side. Al sincronizar offline, esto se ejecuta cuando el server procesa la cola. Comportamiento equivalente.
- **Validación de stock antes de encolar**: para mejorar UX, el form de despacho puede validar contra el cache local (que muestra stock disponible al momento del cache). Esto previene encolar despachos que claramente no van a pasar. Si stock cambió desde el cache, el server lo detectará al sincronizar.
