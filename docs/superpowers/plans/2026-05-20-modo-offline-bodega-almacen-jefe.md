# Modo offline — Sub-fase 5.2b — Plan de implementación

> **Para agentes:** Reutilizar infraestructura de 5.2a. Steps con `- [ ]` para tracking. Commits en español: `feat(offline):` o `chore(offline):`.

**Spec:** `docs/superpowers/specs/2026-05-20-modo-offline-bodega-almacen-jefe-design.md`

**Goal:** Extender modo offline a bodega (despacho/cerrar), almacén (cosecha/salida) y jefe (solo lectura).

**Re-uso:** `lib/offline/` ya existe (db, cache, cola, sync, api-cliente, tipos), `BannerOffline`, hooks. Bumpeamos `db` de versión 1 a 2 sin perder datos.

---

## Task 1: Migración SQL + Prisma

**Files:**
- Create: `supabase/migracion-fase5-offline-bodega-almacen.sql`
- Modify: `prisma/schema.prisma` (agregar `id_local String? @unique @db.Uuid` a `despachos`, `cosechas`, `salidas_cosecha`)
- Append: `supabase/INSTRUCCIONES.md`

SQL:

```sql
-- Sub-fase 5.2b: idempotencia para sync offline de bodega y almacén.

ALTER TABLE despachos ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE cosechas ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;
ALTER TABLE salidas_cosecha ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_despachos_id_local
  ON despachos(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cosechas_id_local
  ON cosechas(id_local) WHERE id_local IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_salidas_cosecha_id_local
  ON salidas_cosecha(id_local) WHERE id_local IS NOT NULL;
```

INSTRUCCIONES.md, agregar sección:

```markdown
## Sub-fase 5.2b (Modo offline bodega/almacén/jefe)

Aplicar `migracion-fase5-offline-bodega-almacen.sql` en SQL Editor. Idempotente.
Después: `npm run db:generate`.
```

Commit: `feat(offline): migracion id_local para bodega y almacen`

---

## Task 2: Extender lib/offline (tipos, db v2, cola, sync, api-cliente, cache)

**Files modificados:**
- `lib/offline/tipos.ts`
- `lib/offline/db.ts`
- `lib/offline/cola.ts`
- `lib/offline/sync.ts`
- `lib/offline/api-cliente.ts`
- `lib/offline/cache.ts`

### 2.1 Tipos nuevos (`lib/offline/tipos.ts`)

Agregar al final del archivo:

```ts
// === Bodega ===

export type HerramientaCacheada = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  total: number;
  prestadas: number;
  disponibles: number;
};

export type InsumoCacheado = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
  stock_disponible: number;
};

export type PersonaCacheada = {
  id: string;
  nombre: string;
};

export type AsignacionResumenCacheada = {
  id: string;
  persona_id: string;
  etiqueta: string;
};

export type DespachoAbiertoItem = {
  id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  nombre: string;
  unidad: string;
  cantidad: number;
};

export type DespachoAbiertoCacheado = {
  id: string;
  persona_nombre: string;
  fecha_despacho: string;
  items: DespachoAbiertoItem[];
};

export type SnapshotBodega = {
  herramientas: HerramientaCacheada[];
  insumos: InsumoCacheado[];
  personas: PersonaCacheada[];
  asignaciones: AsignacionResumenCacheada[];
  despachos_abiertos: DespachoAbiertoCacheado[];
  ts: string;
};

// === Almacén ===

export type LoteParaCosecha = {
  id: string;
  nombre: string;
  total_arboles: number;
};

export type SnapshotAlmacen = {
  lotes: LoteParaCosecha[];
  personas: PersonaCacheada[];
  stock_almacen_kg: number;
  ts: string;
};

// === Jefe ===

export type LoteJefe = {
  id: string;
  nombre: string;
  total_arboles: number;
  tareas_proximas: number;
  tareas_vencidas: number;
  novedades_abiertas: number;
};

export type AsignacionJefe = {
  id: string;
  tipo_tarea_nombre: string;
  persona_nombre: string;
  lote_nombre: string | null;
  apiario_nombre: string | null;
  estado: string;
  fecha_inicio: string;
  arboles_completados: number;
  total_arboles: number | null;
};

export type NovedadJefe = {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  arbol_numero: number;
  lote_nombre: string;
  persona_nombre: string;
  resuelta: boolean;
};

export type AlertaJefe = {
  tipo: "TAREA_VENCIDA" | "TAREA_PROXIMA" | "STOCK_BAJO" | "DESPACHO_ABIERTO" | "NOVEDAD_CRITICA";
  texto: string;
  url: string;
  fecha: string;
};

export type SnapshotJefe = {
  lotes: LoteJefe[];
  asignaciones: AsignacionJefe[];
  novedades: NovedadJefe[];
  alertas: AlertaJefe[];
  ts: string;
};

// === Items de cola nuevos ===

export type ItemColaDespachoCrear = {
  id_local: string;
  persona_id: string;
  asignacion_id: string | null;
  items: Array<{ tipo: "HERRAMIENTA" | "INSUMO"; ref_id: string; cantidad: number }>;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaDespachoCerrar = {
  id_local: string;
  despacho_id: string;
  items: Array<{
    despacho_item_id: string;
    tipo: "HERRAMIENTA" | "INSUMO";
    devuelto?: boolean;
    consumido?: number;
  }>;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaCosecha = {
  id_local: string;
  persona_id: string;
  lote_id: string;
  metodo: "CANASTA" | "BASCULA";
  cantidad_canastas: number | null;
  capacidad_canasta_kg: number | null;
  peso_kg: number;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaSalida = {
  id_local: string;
  tipo: "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";
  cantidad_kg: number;
  cliente_detalle: string | null;
  precio_total: number | null;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};
```

### 2.2 db.ts versión 2

Bumpear `const VERSION = 2;`. Modificar `interface ZelandaOfflineDB` para agregar:

```ts
cache_bodega: { key: string; value: { key: string; data: SnapshotBodega; ts_cache: number } };
cache_almacen: { key: string; value: { key: string; data: SnapshotAlmacen; ts_cache: number } };
cache_jefe: { key: string; value: { key: string; data: SnapshotJefe; ts_cache: number } };
cola_despachos_crear: { key: string; value: ItemColaDespachoCrear; indexes: { por_estado: string } };
cola_despachos_cerrar: { key: string; value: ItemColaDespachoCerrar; indexes: { por_estado: string } };
cola_cosechas: { key: string; value: ItemColaCosecha; indexes: { por_estado: string } };
cola_salidas: { key: string; value: ItemColaSalida; indexes: { por_estado: string } };
```

Modificar `upgrade(db, oldVersion)`:

```ts
upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    // crear stores v1 (existentes en 5.2a) — código tal cual
    if (!db.objectStoreNames.contains("cache_asignaciones")) {
      db.createObjectStore("cache_asignaciones", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("cache_lotes")) {
      db.createObjectStore("cache_lotes", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("cache_meta")) {
      db.createObjectStore("cache_meta", { keyPath: "key" });
    }
    if (!db.objectStoreNames.contains("cola_avances")) {
      const s = db.createObjectStore("cola_avances", { keyPath: "id_local" });
      s.createIndex("por_estado", "estado");
    }
    if (!db.objectStoreNames.contains("cola_novedades")) {
      const s = db.createObjectStore("cola_novedades", { keyPath: "id_local" });
      s.createIndex("por_estado", "estado");
    }
  }
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains("cache_bodega")) {
      db.createObjectStore("cache_bodega", { keyPath: "key" });
    }
    if (!db.objectStoreNames.contains("cache_almacen")) {
      db.createObjectStore("cache_almacen", { keyPath: "key" });
    }
    if (!db.objectStoreNames.contains("cache_jefe")) {
      db.createObjectStore("cache_jefe", { keyPath: "key" });
    }
    for (const nombre of ["cola_despachos_crear", "cola_despachos_cerrar", "cola_cosechas", "cola_salidas"] as const) {
      if (!db.objectStoreNames.contains(nombre)) {
        const s = db.createObjectStore(nombre, { keyPath: "id_local" });
        s.createIndex("por_estado", "estado");
      }
    }
  }
},
```

Agregar imports al top: `SnapshotBodega`, `SnapshotAlmacen`, `SnapshotJefe`, `ItemColaDespachoCrear`, `ItemColaDespachoCerrar`, `ItemColaCosecha`, `ItemColaSalida` desde `./tipos`.

### 2.3 cache.ts

Agregar al final del archivo:

```ts
import type {
  SnapshotBodega,
  SnapshotAlmacen,
  SnapshotJefe,
} from "./tipos";

export async function guardarSnapshotBodega(s: SnapshotBodega): Promise<void> {
  const db = await abrirDb();
  await db.put("cache_bodega", { key: "snapshot", data: s, ts_cache: Date.now() });
}

export async function leerSnapshotBodega(): Promise<SnapshotBodega | null> {
  const db = await abrirDb();
  const r = await db.get("cache_bodega", "snapshot");
  return r?.data ?? null;
}

export async function tsBodega(): Promise<number | null> {
  const db = await abrirDb();
  const r = await db.get("cache_bodega", "snapshot");
  return r?.ts_cache ?? null;
}

export async function guardarSnapshotAlmacen(s: SnapshotAlmacen): Promise<void> {
  const db = await abrirDb();
  await db.put("cache_almacen", { key: "snapshot", data: s, ts_cache: Date.now() });
}

export async function leerSnapshotAlmacen(): Promise<SnapshotAlmacen | null> {
  const db = await abrirDb();
  const r = await db.get("cache_almacen", "snapshot");
  return r?.data ?? null;
}

export async function tsAlmacen(): Promise<number | null> {
  const db = await abrirDb();
  const r = await db.get("cache_almacen", "snapshot");
  return r?.ts_cache ?? null;
}

export async function guardarSnapshotJefe(s: SnapshotJefe): Promise<void> {
  const db = await abrirDb();
  await db.put("cache_jefe", { key: "snapshot", data: s, ts_cache: Date.now() });
}

export async function leerSnapshotJefe(): Promise<SnapshotJefe | null> {
  const db = await abrirDb();
  const r = await db.get("cache_jefe", "snapshot");
  return r?.data ?? null;
}

export async function tsJefe(): Promise<number | null> {
  const db = await abrirDb();
  const r = await db.get("cache_jefe", "snapshot");
  return r?.ts_cache ?? null;
}
```

### 2.4 cola.ts

Cambiar el tipo `TipoCola`:

```ts
type TipoCola = "avance" | "novedad" | "despacho_crear" | "despacho_cerrar" | "cosecha" | "salida";
```

Cambiar `nombreStore`:

```ts
function nombreStore(t: TipoCola): keyof Pick<
  ZelandaOfflineDB,
  "cola_avances" | "cola_novedades" | "cola_despachos_crear" | "cola_despachos_cerrar" | "cola_cosechas" | "cola_salidas"
> {
  switch (t) {
    case "avance": return "cola_avances";
    case "novedad": return "cola_novedades";
    case "despacho_crear": return "cola_despachos_crear";
    case "despacho_cerrar": return "cola_despachos_cerrar";
    case "cosecha": return "cola_cosechas";
    case "salida": return "cola_salidas";
  }
}
```

Agregar imports de tipos nuevos al top y exportar funciones `encolar*` para los 4 nuevos tipos. Patrón idéntico a `encolarAvance`/`encolarNovedad`:

```ts
export async function encolarDespachoCrear(item: ItemColaDespachoCrear): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_despachos_crear", item);
  emitirCambio();
}

export async function encolarDespachoCerrar(item: ItemColaDespachoCerrar): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_despachos_cerrar", item);
  emitirCambio();
}

export async function encolarCosecha(item: ItemColaCosecha): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_cosechas", item);
  emitirCambio();
}

export async function encolarSalida(item: ItemColaSalida): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_salidas", item);
  emitirCambio();
}
```

Actualizar `listarTodos()` para incluir las nuevas colas y reflejar en `contarVisibles`/`contarErrores`:

```ts
export async function listarTodos(): Promise<{
  avances: ItemColaAvance[];
  novedades: ItemColaNovedad[];
  despachos_crear: ItemColaDespachoCrear[];
  despachos_cerrar: ItemColaDespachoCerrar[];
  cosechas: ItemColaCosecha[];
  salidas: ItemColaSalida[];
}> {
  const db = await abrirDb();
  const [avances, novedades, despachos_crear, despachos_cerrar, cosechas, salidas] = await Promise.all([
    db.getAll("cola_avances"),
    db.getAll("cola_novedades"),
    db.getAll("cola_despachos_crear"),
    db.getAll("cola_despachos_cerrar"),
    db.getAll("cola_cosechas"),
    db.getAll("cola_salidas"),
  ]);
  return { avances, novedades, despachos_crear, despachos_cerrar, cosechas, salidas };
}
```

Ajustar `contarVisibles` y `contarErrores` para sumar todas las colas.

### 2.5 sync.ts

Extender `procesarCola()` para iterar sobre los 6 tipos:

```ts
async procesarCola(): Promise<void> {
  if (this.corriendo) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  this.corriendo = true;
  try {
    await this.procesarTipo("avance");
    await this.procesarTipo("novedad");
    await this.procesarTipo("despacho_crear");
    await this.procesarTipo("despacho_cerrar");
    await this.procesarTipo("cosecha");
    await this.procesarTipo("salida");
  } finally {
    this.corriendo = false;
  }
}
```

Mapear cada tipo a su URL y payload-extractor. Agregar funciones:

```ts
function payloadDespachoCrear(i: ItemColaDespachoCrear) {
  return {
    id_local: i.id_local,
    persona_id: i.persona_id,
    asignacion_id: i.asignacion_id,
    items: i.items,
    notas: i.notas,
  };
}

function payloadDespachoCerrar(i: ItemColaDespachoCerrar) {
  return { id_local: i.id_local, despacho_id: i.despacho_id, items: i.items };
}

function payloadCosecha(i: ItemColaCosecha) {
  return {
    id_local: i.id_local,
    persona_id: i.persona_id,
    lote_id: i.lote_id,
    metodo: i.metodo,
    cantidad_canastas: i.cantidad_canastas,
    capacidad_canasta_kg: i.capacidad_canasta_kg,
    peso_kg: i.peso_kg,
    notas: i.notas,
  };
}

function payloadSalida(i: ItemColaSalida) {
  return {
    id_local: i.id_local,
    tipo: i.tipo,
    cantidad_kg: i.cantidad_kg,
    cliente_detalle: i.cliente_detalle,
    precio_total: i.precio_total,
    notas: i.notas,
  };
}
```

Mapping de tipo → endpoint:

```ts
function endpointPara(tipo: "avance" | "novedad" | "despacho_crear" | "despacho_cerrar" | "cosecha" | "salida"): string {
  switch (tipo) {
    case "avance": return "/api/trabajador/avance";
    case "novedad": return "/api/trabajador/novedad";
    case "despacho_crear": return "/api/bodega/despacho/crear";
    case "despacho_cerrar": return "/api/bodega/despacho/cerrar";
    case "cosecha": return "/api/almacen/cosecha";
    case "salida": return "/api/almacen/salida";
  }
}

function payloadDeItem(tipo: string, item: unknown): unknown {
  switch (tipo) {
    case "avance": return payloadAvance(item as ItemColaAvance);
    case "novedad": return payloadNovedad(item as ItemColaNovedad);
    case "despacho_crear": return payloadDespachoCrear(item as ItemColaDespachoCrear);
    case "despacho_cerrar": return payloadDespachoCerrar(item as ItemColaDespachoCerrar);
    case "cosecha": return payloadCosecha(item as ItemColaCosecha);
    case "salida": return payloadSalida(item as ItemColaSalida);
    default: throw new Error("Tipo desconocido");
  }
}
```

Reescribir `procesarTipo` para ser polimórfico:

```ts
private async procesarTipo(tipo: TipoCola): Promise<void> {
  const items = await listarPendientesPorTipo(tipo);
  for (const item of items) {
    if (item.intentos >= MAX_INTENTOS) {
      await marcarErrorPermanente(tipo, item.id_local, item.ultimo_error ?? "Máximo de reintentos");
      continue;
    }
    await marcarSubiendo(tipo, item.id_local);
    try {
      const body = payloadDeItem(tipo, item);
      const res = await fetch(endpointPara(tipo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await marcarSubido(tipo, item.id_local);
      } else if (res.status >= 400 && res.status < 500) {
        const j = await res.json().catch(() => ({}) as { error?: string });
        await marcarErrorPermanente(tipo, item.id_local, j.error ?? `HTTP ${res.status}`);
      } else {
        await marcarFallidoTemp(tipo, item.id_local, `HTTP ${res.status}`);
        await esperar(backoff(item.intentos));
      }
    } catch (e) {
      await marcarFallidoTemp(tipo, item.id_local, (e as Error).message);
      await esperar(backoff(item.intentos));
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
  }
}
```

Donde `TipoCola` se importa desde cola.ts (exportarlo).

### 2.6 api-cliente.ts

Agregar 4 funciones públicas siguiendo el patrón existente:

```ts
import {
  encolarDespachoCrear,
  encolarDespachoCerrar,
  encolarCosecha,
  encolarSalida,
  marcarErrorPermanente,
  marcarSubido,
} from "./cola";
import type {
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
} from "./tipos";

type ResDespachoCrear = Resultado;
type ResDespachoCerrar = Resultado;
type ResCosecha = Resultado;
type ResSalida = Resultado;

export type PayloadDespachoCrear = Omit<ItemColaDespachoCrear, "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en">;
export type PayloadDespachoCerrar = Omit<ItemColaDespachoCerrar, "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en">;
export type PayloadCosecha = Omit<ItemColaCosecha, "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en">;
export type PayloadSalida = Omit<ItemColaSalida, "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en">;

async function enviarGenerico<T extends { id_local: string }>(
  url: string,
  payload: T,
  encolar: (item: never) => Promise<void>,
): Promise<Resultado> {
  // Misma lógica que enviarAvance/enviarNovedad: encolar, intentar fetch, manejar respuestas.
  // ... (replicar patrón existente)
}
```

Lo más simple es replicar el patrón de `enviarAvance` 4 veces. Cada función:
1. Genera UUID
2. Construye `item` con `estado: "pendiente"`, `intentos: 0`, etc.
3. Encola con la función específica
4. Si `navigator.onLine` → fetch al endpoint
5. Si 4xx → marcarErrorPermanente
6. Si 2xx → marcarSubido
7. Si fallo de red / 5xx → deja en cola

Patrón concreto para despacho_crear (los otros análogos):

```ts
export async function enviarDespachoCrear(payload: PayloadDespachoCrear): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaDespachoCrear = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarDespachoCrear(item);
  return intentarSubirGenerico("/api/bodega/despacho/crear", { ...payload, id_local }, "despacho_crear", id_local);
}
```

Donde `intentarSubirGenerico` es una versión refactorizada de `intentarSubir` que toma tipo:

```ts
async function intentarSubirGenerico(
  url: string,
  body: unknown,
  tipo: "avance" | "novedad" | "despacho_crear" | "despacho_cerrar" | "cosecha" | "salida",
  id_local: string,
): Promise<Resultado> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: true, offline: true, id_local };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await marcarSubido(tipo, id_local);
      return { ok: true, offline: false, id_local };
    }
    if (res.status >= 400 && res.status < 500) {
      const j = await res.json().catch(() => ({}) as { error?: string });
      const err = j.error ?? `HTTP ${res.status}`;
      await marcarErrorPermanente(tipo, id_local, err);
      return { ok: false, error: err };
    }
    return { ok: true, offline: true, id_local };
  } catch {
    return { ok: true, offline: true, id_local };
  }
}
```

Refactorizar `enviarAvance` y `enviarNovedad` para usar `intentarSubirGenerico`.

Commit (todo el Task 2): `feat(offline): extender lib offline para bodega, almacen y jefe`

---

## Task 3: API routes bodega

**Files:**
- Create: `app/api/bodega/snapshot/route.ts`
- Create: `app/api/bodega/despacho/crear/route.ts`
- Create: `app/api/bodega/despacho/cerrar/route.ts`

### 3.1 Snapshot bodega

GET. Requiere rol BODEGA. Devuelve:

```ts
{
  herramientas: [{id, nombre, categoria, unidad, total, prestadas, disponibles}],
  insumos: [{id, nombre, categoria, unidad, stock_actual, stock_reservado, stock_minimo, stock_disponible}],
  personas: [{id, nombre}],   // personas activas con vinculacion vigente
  asignaciones: [{id, persona_id, etiqueta}],  // PENDIENTE/EN_CURSO
  despachos_abiertos: [{id, persona_nombre, fecha_despacho, items: [{id, tipo, nombre, unidad, cantidad}]}],
  ts: ISO string
}
```

Usar `prisma.$queryRaw` con `v_insumos_stock` para disponibles. Filtrar herramientas/insumos por `activo: true`.

### 3.2 Despacho crear

POST. Body: `{ id_local, persona_id, asignacion_id, items, notas }`. Lógica: replicar exactamente `crearDespacho` en `app/(app)/bodega/despachos/acciones.ts`, pero:
- Sin `revalidatePath` / `redirect`
- Agregar guard de idempotencia: `findUnique({ where: { id_local } })` → si existe, retornar `{ ok: true, id: ..., duplicado: true }`
- Guardar `id_local` en `despachos.create(...)`
- Validar UUID con regex
- Retornar `{ ok: true, id: String(despacho.id) }` o `{ error }` con código 400/409

### 3.3 Despacho cerrar

POST. Body: `{ id_local, despacho_id, items: [{ despacho_item_id, tipo, devuelto?, consumido? }] }`. Replicar `cerrarDespacho` con:
- Idempotencia por `id_local` (la columna `id_local` es en `despachos` no `despachos_items`; aquí necesitamos otra estrategia)

**Problema**: `cerrarDespacho` no crea una nueva fila — actualiza el despacho existente. La idempotencia no aplica igual.

**Solución pragmática**: si el despacho ya está `CERRADO` cuando llega el sync, asumimos que es la misma operación (idempotente por estado, no por id_local). Verificar también que `items` matches con lo que ya se grabó (sanity check). Retornar 200 OK con `{ ok: true, duplicado: true }`.

Si llega un cierre y otro bodeguero lo cerró antes con otros valores, no se sobreescribe — retornar 409 con error claro.

### 3.4 Constraints

Tres commits:
- `feat(offline): API bodega snapshot`
- `feat(offline): API bodega crear despacho idempotente`
- `feat(offline): API bodega cerrar despacho idempotente`

O un commit único: `feat(offline): API routes bodega (snapshot, crear, cerrar)`. Elegir lo último por simplicidad.

---

## Task 4: Migrar formularios bodega a offline

**Files:**
- Modify: `app/(app)/bodega/despachos/nuevo/_formulario.tsx` (usar `enviarDespachoCrear`)
- Modify: `app/(app)/bodega/despachos/nuevo/page.tsx` (servir snapshot inicial para hydratar cache)
- Modify: `app/(app)/bodega/despachos/[id]/_formulario.tsx` (usar `enviarDespachoCerrar`)
- Modify: `app/(app)/bodega/despachos/[id]/page.tsx` (idem)

Patrón: el page sigue siendo Server Component que fetch-ea con Prisma. El formulario es Client Component que ya no usa `useActionState` sino `useTransition` + `enviarDespachoCrear`/`enviarDespachoCerrar`. Mostrar banner `<CloudOff />` cuando offline.

El form de crear despacho ya tiene los selects de personas/asignaciones/herramientas/insumos como props. Mantener firma. Cambiar el submit:

```tsx
async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  // ... validaciones client side similares al actual server action
  startTransition(async () => {
    const r = await enviarDespachoCrear({
      persona_id: personaId,
      asignacion_id: asignacionId || null,
      items: items.map((i) => ({ tipo: i.tipo, ref_id: i.ref_id, cantidad: Number(i.cantidad) })),
      notas: notas || null,
    });
    if (!r.ok) { setError(r.error); return; }
    router.push("/bodega/despachos");
  });
}
```

El form de cerrar despacho recibe `items` con cantidades originales. Submit:

```tsx
const itemsPayload = items.map((it) => {
  if (it.tipo === "HERRAMIENTA") {
    return { despacho_item_id: it.id, tipo: "HERRAMIENTA" as const, devuelto: !!formData.get(`devuelto_${it.id}`) };
  }
  return {
    despacho_item_id: it.id,
    tipo: "INSUMO" as const,
    consumido: Number(formData.get(`consumido_${it.id}`) ?? 0),
  };
});
const r = await enviarDespachoCerrar({ despacho_id: despachoId, items: itemsPayload });
```

Eliminar imports de las server actions (`crearDespacho`, `cerrarDespacho`) y eliminar también el archivo `acciones.ts` de `bodega/despachos/` si ya no se usa en ninguna otra parte.

Commit: `feat(offline): migrar formularios bodega a sync offline`

---

## Task 5: Migrar formularios almacén a offline

**Files:**
- Modify: `app/(app)/almacen/cosecha/nueva/_formulario.tsx`
- Modify: `app/(app)/almacen/salidas/nueva/_formulario.tsx`

Idéntico patrón. Validación client-side. Uso de `enviarCosecha` y `enviarSalida`. Eliminar imports server actions. Si el archivo `acciones.ts` queda sin referencias, eliminar.

Commit: `feat(offline): migrar formularios almacen a sync offline`

---

## Task 6: APIs almacén

**Files:**
- Create: `app/api/almacen/snapshot/route.ts`
- Create: `app/api/almacen/cosecha/route.ts`
- Create: `app/api/almacen/salida/route.ts`

Snapshot: GET, requiere ALMACEN. Devuelve `lotes` (con `total_arboles > 0` y `deleted_at IS NULL`), `personas` activas, `stock_almacen_kg` (via `v_stock_almacen`).

Cosecha: POST, idempotente por `id_local`. Replicar `crearCosecha` sin redirect. Guardar `id_local`.

Salida: POST, idempotente por `id_local`. Replicar `crearSalida`. Validar stock al sync.

Commit: `feat(offline): API routes almacen (snapshot, cosecha, salida)`

---

## Task 7: Pantallas /bodega/pendientes y /almacen/pendientes

**Files:**
- Create: `app/(app)/bodega/pendientes/page.tsx`
- Create: `app/(app)/bodega/pendientes/_lista-cliente.tsx`
- Create: `app/(app)/almacen/pendientes/page.tsx`
- Create: `app/(app)/almacen/pendientes/_lista-cliente.tsx`

Similar a `/trabajador/pendientes`. Filtran los items relevantes para cada rol:
- Bodega: avances NO; novedades NO; despacho_crear SÍ; despacho_cerrar SÍ
- Almacén: cosechas SÍ; salidas SÍ

UX: lista con título + detalle + estado + reintentar/borrar para `error_permanente`. Botón "Sincronizar ahora".

Commit: `feat(offline): pantallas pendientes para bodega y almacen`

---

## Task 8: API jefe snapshot

**File:**
- Create: `app/api/jefe/snapshot/route.ts`

GET, requiere JEFE. Devuelve:

```ts
{
  lotes: [{id, nombre, total_arboles, tareas_proximas, tareas_vencidas, novedades_abiertas}],
  asignaciones: [{id, tipo_tarea_nombre, persona_nombre, lote_nombre, apiario_nombre, estado, fecha_inicio, arboles_completados, total_arboles}],
  novedades: [{id, tipo, descripcion, fecha, arbol_numero, lote_nombre, persona_nombre, resuelta}],  // no resueltas
  alertas: [{tipo, texto, url, fecha}],
  ts: ISO
}
```

Las "alertas" son una compilación derivada de:
- Tareas con `proxima_fecha_programada` vencida o próxima (< 7 días)
- Insumos con `stock_disponible <= stock_minimo`
- Despachos `estado = ABIERTO` antiguos (> 24h)
- Novedades críticas (tipo PLAGA o DANO_FISICO, no resueltas, < 7 días)

Mantener queries simples y rápidas. Limitar a 20 items por categoría.

Commit: `feat(offline): API jefe snapshot para lectura offline`

---

## Task 9: Páginas jefe leyendo cache

**Files modificados:**
- `app/(app)/jefe/page.tsx` (dashboard)
- `app/(app)/jefe/lotes/page.tsx`
- `app/(app)/jefe/asignaciones/page.tsx`
- `app/(app)/jefe/novedades/page.tsx`
- `app/(app)/jefe/alertas/page.tsx` (si existe; si no, no tocar)

Para cada una:
- Si es Server Component que solo lista datos del snapshot: refactorizar a Server Component que también devuelve `snapshotInicial` + Client Component que lee del cache, idéntico patrón al `_lista-tareas-cliente.tsx` del trabajador.
- En `online`: revalida en background. En `offline`: muestra datos cacheados con badge "actualizado hace X" (calculado desde `tsJefe()`).

**Files nuevos:**
- `app/(app)/jefe/_dashboard-cliente.tsx`
- `app/(app)/jefe/lotes/_lista-cliente.tsx`
- `app/(app)/jefe/asignaciones/_lista-cliente.tsx`
- `app/(app)/jefe/novedades/_lista-cliente.tsx`

> **Nota práctica**: si una página tiene UI compleja (gráficos, filtros, etc.), no romper para esta sub-fase. Solo convertir las listas básicas. Para edición/detalle queda online. Si una pantalla específica es muy compleja de convertir, mantenerla online y documentar en INSTRUCCIONES.md.

Commit: `feat(offline): paginas del jefe leen cache local cuando hay snapshot`

---

## Task 10: Build, lint, smoke test

- [ ] `npm run lint` (esperar 0 errores)
- [ ] `npm run build` (esperar build exitoso)
- [ ] Probar manualmente:
  - Bodega online: crear despacho normal → verificar BD
  - Bodega offline: crear despacho → ver banner "1 pendiente" → reconectar → ver sync → verificar BD
  - Bodega offline: cerrar despacho → idem
  - Almacén online y offline: cosecha, salida
  - Idempotencia: doble submit (mismo `id_local`)
  - Conflicto stock: despachar offline cantidad mayor a stock → al sync, error_permanente → revisar en `/bodega/pendientes`
  - Jefe offline: abrir `/jefe`, ver dashboard cacheado con timestamp "actualizado hace X"

- [ ] Commit final si hubo ajustes

---

## Task 11: Docs + push

**Files:**
- Modify: `CLAUDE.md` (marcar 5.2b ✅)
- Push: `git push origin main`

Commit: `docs: marcar sub-fase 5.2b (offline bodega/almacen/jefe-readonly) como completada`

---

## Manual pending (usuario)

1. Aplicar `supabase/migracion-fase5-offline-bodega-almacen.sql` en Supabase SQL Editor.
2. `npm run db:generate` local.
3. Probar en celular tras deploy.

---

## Resumen

11 tareas. Re-usa toda la infra de 5.2a. Stock validation se hace server-side al sync (idempotencia + 409 si stock insuficiente).
