# Modo offline — Sub-fase 5.2a — Plan de implementación

> **Para agentes:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development` o `superpowers:executing-plans`. Steps usan `- [ ]` para tracking.

**Spec:** `docs/superpowers/specs/2026-05-20-modo-offline-trabajador-design.md`

**Goal:** Habilitar al trabajador a operar sin señal (ver tareas, registrar avance/novedad) con sincronización automática al volver online. Sin fotos en esta fase.

**Arquitectura:** Service Worker extendido + IndexedDB (idb) con stores de cache y cola + sync engine con backoff + API routes idempotentes por `id_local` UUID + pill flotante de estado.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6, IndexedDB vía `idb` lib, PostgreSQL/PostGIS, Supabase.

---

## Convención de commits

Cada commit con prefijo `feat(offline):` o `chore(offline):` según corresponda. Mensajes en español.

---

## Task 1: Migración SQL + Prisma schema

**Files:**
- Create: `supabase/migracion-fase5-offline-trabajador.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Crear archivo de migración SQL**

`supabase/migracion-fase5-offline-trabajador.sql`:

```sql
-- Sub-fase 5.2a: idempotencia para sync offline del trabajador
-- Agrega id_local UUID UNIQUE a tablas que aceptan creación desde cola offline.

ALTER TABLE registros_avance
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_registros_avance_id_local
  ON registros_avance(id_local) WHERE id_local IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_novedades_id_local
  ON novedades(id_local) WHERE id_local IS NOT NULL;
```

- [ ] **Step 2: Actualizar `prisma/schema.prisma`**

Localizar el modelo `registros_avance` y agregar antes del cierre del bloque:

```prisma
  id_local         String?    @unique @db.Uuid
```

Localizar el modelo `novedades` y agregar antes del cierre del bloque:

```prisma
  id_local         String?    @unique @db.Uuid
```

- [ ] **Step 3: Documentar aplicación manual**

Crear archivo `supabase/INSTRUCCIONES.md` (si no existe) o agregar al final:

```markdown
## Sub-fase 5.2a (Modo offline trabajador)

Aplicar `migracion-fase5-offline-trabajador.sql` en SQL Editor de Supabase. Idempotente, se puede correr varias veces.

Después: `npm run db:pull` para refrescar el cliente Prisma (o usar `db:generate` si el schema ya quedó alineado a mano).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migracion-fase5-offline-trabajador.sql prisma/schema.prisma supabase/INSTRUCCIONES.md
git commit -m "feat(offline): migracion id_local para idempotencia de sync"
```

---

## Task 2: Instalar `idb` y crear cliente IndexedDB

**Files:**
- Modify: `package.json` (vía `npm install`)
- Create: `lib/offline/db.ts`
- Create: `lib/offline/uuid.ts`
- Create: `lib/offline/tipos.ts`

- [ ] **Step 1: Instalar `idb`**

```bash
npm install idb
```

- [ ] **Step 2: Crear `lib/offline/tipos.ts` con tipos compartidos**

```ts
// Tipos compartidos para cache y cola offline.

export type AreaTarea = "CULTIVO" | "APICULTURA";
export type EstadoAsignacion = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
export type TipoRegistro = "TRAMO" | "SUELTOS" | "VISITA";
export type TipoNovedad = "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
export type EstadoCola = "pendiente" | "subiendo" | "subido" | "error_permanente";

export type AsignacionCacheada = {
  id: string;
  persona_id: string;
  tipo_tarea_id: string;
  tipo_tarea_nombre: string;
  tipo_tarea_area: AreaTarea;
  lote_id: string | null;
  lote_nombre: string | null;
  total_arboles: number | null;
  arboles_completados: number;
  ultimo_arbol_trabajado: number;
  apiario_id: string | null;
  apiario_nombre: string | null;
  total_colmenas: number | null;
  estado: EstadoAsignacion;
  fecha_inicio: string;
  ts_cache: number;
};

export type LoteCacheado = {
  id: string;
  nombre: string;
  total_arboles: number;
  ts_cache: number;
};

export type MetaCache = { key: string; value: unknown };

export type ItemColaAvance = {
  id_local: string;
  asignacion_id: string;
  tipo_registro: TipoRegistro;
  arbol_desde: number | null;
  arbol_hasta: number | null;
  arboles_lista: number[];
  observaciones: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaNovedad = {
  id_local: string;
  lote_id: string;
  numero_placa: number;
  tipo: TipoNovedad;
  descripcion: string;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type SnapshotTrabajador = {
  asignaciones: AsignacionCacheada[];
  lotes: LoteCacheado[];
  ts: string;
};
```

- [ ] **Step 3: Crear `lib/offline/uuid.ts`**

```ts
export function generarUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback compatible con UUIDv4 (poco probable de usarse en navegadores modernos)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

- [ ] **Step 4: Crear `lib/offline/db.ts`**

```ts
import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  AsignacionCacheada,
  LoteCacheado,
  MetaCache,
  ItemColaAvance,
  ItemColaNovedad,
} from "./tipos";

interface ZelandaOfflineDB extends DBSchema {
  cache_asignaciones: { key: string; value: AsignacionCacheada };
  cache_lotes: { key: string; value: LoteCacheado };
  cache_meta: { key: string; value: MetaCache };
  cola_avances: {
    key: string;
    value: ItemColaAvance;
    indexes: { por_estado: string };
  };
  cola_novedades: {
    key: string;
    value: ItemColaNovedad;
    indexes: { por_estado: string };
  };
}

const NOMBRE_DB = "zelanda-offline-v1";
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ZelandaOfflineDB>> | null = null;

export function abrirDb(): Promise<IDBPDatabase<ZelandaOfflineDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible en server"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ZelandaOfflineDB>(NOMBRE_DB, VERSION, {
      upgrade(db) {
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
          const store = db.createObjectStore("cola_avances", { keyPath: "id_local" });
          store.createIndex("por_estado", "estado");
        }
        if (!db.objectStoreNames.contains("cola_novedades")) {
          const store = db.createObjectStore("cola_novedades", { keyPath: "id_local" });
          store.createIndex("por_estado", "estado");
        }
      },
    });
  }
  return dbPromise;
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/offline/
git commit -m "feat(offline): IndexedDB con idb (db, uuid, tipos compartidos)"
```

---

## Task 3: Cache layer (lectura/escritura de cache)

**Files:**
- Create: `lib/offline/cache.ts`

- [ ] **Step 1: Crear `lib/offline/cache.ts`**

```ts
import { abrirDb } from "./db";
import type {
  AsignacionCacheada,
  LoteCacheado,
  SnapshotTrabajador,
} from "./tipos";

const TTL_CACHE_MS = 5 * 60 * 1000; // 5 minutos

export async function guardarSnapshotTrabajador(s: SnapshotTrabajador): Promise<void> {
  const db = await abrirDb();
  const tx = db.transaction(["cache_asignaciones", "cache_lotes", "cache_meta"], "readwrite");
  const ts = Date.now();

  // Limpiar lo viejo
  await tx.objectStore("cache_asignaciones").clear();
  await tx.objectStore("cache_lotes").clear();

  for (const a of s.asignaciones) {
    await tx.objectStore("cache_asignaciones").put({ ...a, ts_cache: ts });
  }
  for (const l of s.lotes) {
    await tx.objectStore("cache_lotes").put({ ...l, ts_cache: ts });
  }
  await tx.objectStore("cache_meta").put({ key: "snapshot_ts", value: ts });
  await tx.done;
}

export async function leerAsignaciones(): Promise<AsignacionCacheada[]> {
  const db = await abrirDb();
  return db.getAll("cache_asignaciones");
}

export async function leerAsignacion(id: string): Promise<AsignacionCacheada | undefined> {
  const db = await abrirDb();
  return db.get("cache_asignaciones", id);
}

export async function leerLotes(): Promise<LoteCacheado[]> {
  const db = await abrirDb();
  return db.getAll("cache_lotes");
}

export async function cacheFresca(): Promise<boolean> {
  const db = await abrirDb();
  const meta = await db.get("cache_meta", "snapshot_ts");
  if (!meta || typeof meta.value !== "number") return false;
  return Date.now() - meta.value < TTL_CACHE_MS;
}

export async function tsSnapshot(): Promise<number | null> {
  const db = await abrirDb();
  const meta = await db.get("cache_meta", "snapshot_ts");
  return typeof meta?.value === "number" ? meta.value : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/offline/cache.ts
git commit -m "feat(offline): cache layer para snapshot del trabajador"
```

---

## Task 4: Cola layer (gestión de items pendientes)

**Files:**
- Create: `lib/offline/cola.ts`
- Create: `lib/offline/eventos.ts`

- [ ] **Step 1: Crear `lib/offline/eventos.ts` (event emitter simple)**

```ts
// Emisor de eventos para que las pantallas reaccionen a cambios en la cola.

type Listener = () => void;

const listeners: Set<Listener> = new Set();

export function suscribirseACambios(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitirCambio(): void {
  listeners.forEach((fn) => fn());
}
```

- [ ] **Step 2: Crear `lib/offline/cola.ts`**

```ts
import { abrirDb } from "./db";
import { emitirCambio } from "./eventos";
import type {
  EstadoCola,
  ItemColaAvance,
  ItemColaNovedad,
} from "./tipos";

type TipoCola = "avance" | "novedad";
type ItemCola = ItemColaAvance | ItemColaNovedad;

function nombreStore(t: TipoCola): "cola_avances" | "cola_novedades" {
  return t === "avance" ? "cola_avances" : "cola_novedades";
}

export async function encolarAvance(item: ItemColaAvance): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_avances", item);
  emitirCambio();
}

export async function encolarNovedad(item: ItemColaNovedad): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_novedades", item);
  emitirCambio();
}

export async function listarPendientesPorTipo<T extends TipoCola>(
  tipo: T,
): Promise<T extends "avance" ? ItemColaAvance[] : ItemColaNovedad[]> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const items = await db.getAllFromIndex(store, "por_estado", "pendiente");
  return items as never;
}

export async function listarTodos(): Promise<{
  avances: ItemColaAvance[];
  novedades: ItemColaNovedad[];
}> {
  const db = await abrirDb();
  const [avances, novedades] = await Promise.all([
    db.getAll("cola_avances"),
    db.getAll("cola_novedades"),
  ]);
  return { avances, novedades };
}

export async function contarVisibles(): Promise<number> {
  const { avances, novedades } = await listarTodos();
  const visibles = (i: ItemCola) =>
    i.estado === "pendiente" || i.estado === "subiendo" || i.estado === "error_permanente";
  return avances.filter(visibles).length + novedades.filter(visibles).length;
}

export async function contarErrores(): Promise<number> {
  const { avances, novedades } = await listarTodos();
  return (
    avances.filter((i) => i.estado === "error_permanente").length +
    novedades.filter((i) => i.estado === "error_permanente").length
  );
}

async function actualizarEstado(
  tipo: TipoCola,
  id_local: string,
  parche: Partial<ItemCola>,
): Promise<void> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const actual = await db.get(store, id_local);
  if (!actual) return;
  await db.put(store, { ...actual, ...parche } as ItemCola);
  emitirCambio();
}

export async function marcarSubiendo(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: "subiendo" });
}

export async function marcarSubido(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: "subido" });
  // Borrar tras 5s para dejar feedback breve
  setTimeout(() => borrarItem(tipo, id_local).catch(() => undefined), 5000);
}

export async function marcarFallidoTemp(
  tipo: TipoCola,
  id_local: string,
  error: string,
): Promise<void> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const actual = await db.get(store, id_local);
  if (!actual) return;
  await db.put(store, {
    ...actual,
    estado: "pendiente",
    intentos: actual.intentos + 1,
    ultimo_error: error,
  } as ItemCola);
  emitirCambio();
}

export async function marcarErrorPermanente(
  tipo: TipoCola,
  id_local: string,
  error: string,
): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: "error_permanente", ultimo_error: error });
}

export async function reintentar(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, {
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
  });
}

export async function borrarItem(tipo: TipoCola, id_local: string): Promise<void> {
  const db = await abrirDb();
  await db.delete(nombreStore(tipo), id_local);
  emitirCambio();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/offline/cola.ts lib/offline/eventos.ts
git commit -m "feat(offline): cola de pendientes con event emitter"
```

---

## Task 5: Sync engine + cliente API unificado

**Files:**
- Create: `lib/offline/sync.ts`
- Create: `lib/offline/api-cliente.ts`

- [ ] **Step 1: Crear `lib/offline/api-cliente.ts`**

```ts
import { generarUuid } from "./uuid";
import { encolarAvance, encolarNovedad, marcarErrorPermanente, marcarSubido } from "./cola";
import type { ItemColaAvance, ItemColaNovedad } from "./tipos";

type Resultado =
  | { ok: true; offline: boolean; id_local: string }
  | { ok: false; error: string };

export type PayloadAvance = Omit<
  ItemColaAvance,
  "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en"
>;
export type PayloadNovedad = Omit<
  ItemColaNovedad,
  "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en"
>;

export async function enviarAvance(payload: PayloadAvance): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaAvance = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarAvance(item);
  return intentarSubir("avance", id_local, payload);
}

export async function enviarNovedad(payload: PayloadNovedad): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaNovedad = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarNovedad(item);
  return intentarSubir("novedad", id_local, payload);
}

async function intentarSubir(
  tipo: "avance" | "novedad",
  id_local: string,
  payload: PayloadAvance | PayloadNovedad,
): Promise<Resultado> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: true, offline: true, id_local };
  }
  try {
    const res = await fetch(`/api/trabajador/${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id_local }),
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

- [ ] **Step 2: Crear `lib/offline/sync.ts`**

```ts
import {
  listarPendientesPorTipo,
  marcarSubiendo,
  marcarSubido,
  marcarFallidoTemp,
  marcarErrorPermanente,
} from "./cola";
import type { ItemColaAvance, ItemColaNovedad } from "./tipos";

const BACKOFFS_MS = [1000, 5000, 30000, 300000];
const MAX_INTENTOS = 5;

function backoff(intentos: number): number {
  return BACKOFFS_MS[Math.min(intentos, BACKOFFS_MS.length - 1)];
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function payloadAvance(i: ItemColaAvance) {
  return {
    id_local: i.id_local,
    asignacion_id: i.asignacion_id,
    tipo_registro: i.tipo_registro,
    arbol_desde: i.arbol_desde,
    arbol_hasta: i.arbol_hasta,
    arboles_lista: i.arboles_lista,
    observaciones: i.observaciones,
  };
}

function payloadNovedad(i: ItemColaNovedad) {
  return {
    id_local: i.id_local,
    lote_id: i.lote_id,
    numero_placa: i.numero_placa,
    tipo: i.tipo,
    descripcion: i.descripcion,
  };
}

class SyncEngineImpl {
  private corriendo = false;
  private inicializado = false;

  init(): void {
    if (typeof window === "undefined" || this.inicializado) return;
    this.inicializado = true;
    window.addEventListener("online", () => {
      this.procesarCola().catch(() => undefined);
    });
    if (navigator.onLine) {
      this.procesarCola().catch(() => undefined);
    }
  }

  async procesarCola(): Promise<void> {
    if (this.corriendo) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    this.corriendo = true;
    try {
      await this.procesarTipo("avance");
      await this.procesarTipo("novedad");
    } finally {
      this.corriendo = false;
    }
  }

  private async procesarTipo(tipo: "avance" | "novedad"): Promise<void> {
    const items =
      tipo === "avance"
        ? await listarPendientesPorTipo("avance")
        : await listarPendientesPorTipo("novedad");
    for (const item of items) {
      if (item.intentos >= MAX_INTENTOS) {
        await marcarErrorPermanente(tipo, item.id_local, item.ultimo_error ?? "Máximo de reintentos");
        continue;
      }
      await marcarSubiendo(tipo, item.id_local);
      try {
        const body =
          tipo === "avance"
            ? payloadAvance(item as ItemColaAvance)
            : payloadNovedad(item as ItemColaNovedad);
        const res = await fetch(`/api/trabajador/${tipo}`, {
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
}

export const SyncEngine = new SyncEngineImpl();
```

- [ ] **Step 3: Commit**

```bash
git add lib/offline/sync.ts lib/offline/api-cliente.ts
git commit -m "feat(offline): sync engine con backoff y cliente API unificado"
```

---

## Task 6: Hooks de React (online status + contador pendientes)

**Files:**
- Create: `hooks/useOnlineStatus.ts`
- Create: `hooks/useColaPendientes.ts`

- [ ] **Step 1: Crear `hooks/useOnlineStatus.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
```

- [ ] **Step 2: Crear `hooks/useColaPendientes.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { suscribirseACambios } from "@/lib/offline/eventos";
import { contarVisibles, contarErrores } from "@/lib/offline/cola";

export function useColaPendientes(): { total: number; errores: number } {
  const [total, setTotal] = useState(0);
  const [errores, setErrores] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function refrescar() {
      const [t, e] = await Promise.all([contarVisibles(), contarErrores()]);
      if (!cancelado) {
        setTotal(t);
        setErrores(e);
      }
    }
    refrescar();
    const desuscribir = suscribirseACambios(refrescar);
    return () => {
      cancelado = true;
      desuscribir();
    };
  }, []);

  return { total, errores };
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/
git commit -m "feat(offline): hooks useOnlineStatus y useColaPendientes"
```

---

## Task 7: API routes idempotentes

**Files:**
- Create: `app/api/trabajador/snapshot/route.ts`
- Create: `app/api/trabajador/avance/route.ts`
- Create: `app/api/trabajador/novedad/route.ts`

- [ ] **Step 1: Crear `app/api/trabajador/snapshot/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "TRABAJADOR" || usuario.persona_id === null) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const personaId = BigInt(usuario.persona_id);

  const asignaciones = await prisma.asignaciones.findMany({
    where: { persona_id: personaId, estado: { in: ["PENDIENTE", "EN_CURSO"] } },
    orderBy: { fecha_inicio: "asc" },
    include: {
      tipos_tarea: { select: { id: true, nombre: true, area: true } },
      lotes: { select: { id: true, nombre: true, total_arboles: true } },
    },
  });

  const apiarioIds = Array.from(
    new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
  );
  const apiarios = apiarioIds.length
    ? await prisma.apiarios.findMany({
        where: { id: { in: apiarioIds } },
        select: { id: true, nombre: true, total_colmenas: true },
      })
    : [];
  const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a]));

  // Lotes para crear novedad: traer todos los lotes con árboles cargados
  const lotes = await prisma.lotes.findMany({
    where: { deleted_at: null, total_arboles: { gt: 0 } },
    select: { id: true, nombre: true, total_arboles: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({
    asignaciones: asignaciones.map((a) => {
      const ap = a.apiario_id ? mapaApiario.get(String(a.apiario_id)) : null;
      return {
        id: String(a.id),
        persona_id: String(a.persona_id),
        tipo_tarea_id: String(a.tipo_tarea_id),
        tipo_tarea_nombre: a.tipos_tarea.nombre,
        tipo_tarea_area: a.tipos_tarea.area,
        lote_id: a.lote_id ? String(a.lote_id) : null,
        lote_nombre: a.lotes?.nombre ?? null,
        total_arboles: a.lotes?.total_arboles ?? null,
        arboles_completados: a.arboles_completados,
        ultimo_arbol_trabajado: a.ultimo_arbol_trabajado,
        apiario_id: a.apiario_id ? String(a.apiario_id) : null,
        apiario_nombre: ap?.nombre ?? null,
        total_colmenas: ap?.total_colmenas ?? null,
        estado: a.estado,
        fecha_inicio: a.fecha_inicio.toISOString(),
      };
    }),
    lotes: lotes.map((l) => ({
      id: String(l.id),
      nombre: l.nombre,
      total_arboles: l.total_arboles,
    })),
    ts: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Crear `app/api/trabajador/avance/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  id_local: string;
  asignacion_id: string;
  tipo_registro: "TRAMO" | "SUELTOS" | "VISITA";
  arbol_desde: number | null;
  arbol_hasta: number | null;
  arboles_lista: number[];
  observaciones: string | null;
};

function esUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "TRABAJADOR" || usuario.persona_id === null) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!esUuid(body.id_local)) {
    return NextResponse.json({ error: "id_local inválido" }, { status: 400 });
  }

  // Idempotencia: si ya existe, devolver OK
  const existente = await prisma.registros_avance.findUnique({
    where: { id_local: body.id_local },
    select: { id: true },
  });
  if (existente) {
    return NextResponse.json({ ok: true, id: String(existente.id), duplicado: true });
  }

  if (!/^\d+$/.test(body.asignacion_id)) {
    return NextResponse.json({ error: "asignacion_id inválido" }, { status: 400 });
  }
  const asignacionId = BigInt(body.asignacion_id);
  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: { lotes: { select: { total_arboles: true } } },
  });
  if (!asignacion) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  if (BigInt(usuario.persona_id) !== asignacion.persona_id) {
    return NextResponse.json({ error: "No es tu asignación" }, { status: 403 });
  }
  if (asignacion.estado !== "PENDIENTE" && asignacion.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Asignación cerrada" }, { status: 409 });
  }

  const observaciones = body.observaciones?.trim() || null;

  if (body.tipo_registro === "VISITA") {
    if (asignacion.apiario_id === null) {
      return NextResponse.json({ error: "VISITA solo aplica a apiario" }, { status: 400 });
    }
    const creado = await prisma.$transaction(async (tx) => {
      const r = await tx.registros_avance.create({
        data: {
          id_local: body.id_local,
          asignacion_id: asignacionId,
          persona_id: BigInt(usuario.persona_id!),
          tipo_registro: "VISITA",
          cantidad_arboles: 0,
          arboles_lista: [],
          observaciones,
        },
      });
      await tx.asignaciones.update({
        where: { id: asignacionId },
        data: { estado: "COMPLETADA", fecha_completada: new Date() },
      });
      return r;
    });
    return NextResponse.json({ ok: true, id: String(creado.id) });
  }

  if (asignacion.lote_id === null) {
    return NextResponse.json({ error: "TRAMO/SUELTOS solo aplica a lote" }, { status: 400 });
  }
  const totalArboles = asignacion.lotes?.total_arboles ?? 0;
  if (totalArboles <= 0) {
    return NextResponse.json({ error: "Lote sin árboles cargados" }, { status: 409 });
  }

  let cantidad = 0;
  let arbol_desde: number | null = null;
  let arbol_hasta: number | null = null;
  let arboles_lista: number[] = [];

  if (body.tipo_registro === "TRAMO") {
    const d = body.arbol_desde;
    const h = body.arbol_hasta;
    if (typeof d !== "number" || typeof h !== "number" || d < 1 || h < 1 || d > totalArboles || h > totalArboles) {
      return NextResponse.json({ error: `Números fuera de rango (1..${totalArboles})` }, { status: 400 });
    }
    if (d > h) return NextResponse.json({ error: "Desde > Hasta" }, { status: 400 });
    arbol_desde = d;
    arbol_hasta = h;
    cantidad = h - d + 1;
  } else if (body.tipo_registro === "SUELTOS") {
    const lista = Array.isArray(body.arboles_lista) ? body.arboles_lista : [];
    if (lista.length === 0 || lista.some((n) => !Number.isInteger(n) || n < 1)) {
      return NextResponse.json({ error: "Lista de árboles inválida" }, { status: 400 });
    }
    const fueraRango = lista.filter((n) => n > totalArboles);
    if (fueraRango.length > 0) {
      return NextResponse.json({
        error: `Números fuera de rango: ${fueraRango.slice(0, 5).join(", ")}`,
      }, { status: 400 });
    }
    arboles_lista = lista;
    cantidad = lista.length;
  } else {
    return NextResponse.json({ error: "tipo_registro inválido" }, { status: 400 });
  }

  const nuevoTotal = asignacion.arboles_completados + cantidad;
  const debeCompletar = nuevoTotal >= totalArboles;

  const creado = await prisma.$transaction(async (tx) => {
    const r = await tx.registros_avance.create({
      data: {
        id_local: body.id_local,
        asignacion_id: asignacionId,
        persona_id: BigInt(usuario.persona_id!),
        tipo_registro: body.tipo_registro === "TRAMO" ? "TRAMO" : "SUELTOS",
        arbol_desde,
        arbol_hasta,
        arboles_lista,
        cantidad_arboles: cantidad,
        observaciones,
      },
    });
    await tx.asignaciones.update({
      where: { id: asignacionId },
      data: {
        arboles_completados: nuevoTotal,
        ultimo_arbol_trabajado:
          arbol_hasta !== null
            ? Math.max(asignacion.ultimo_arbol_trabajado, arbol_hasta)
            : asignacion.ultimo_arbol_trabajado,
        estado: debeCompletar ? "COMPLETADA" : "EN_CURSO",
        fecha_completada: debeCompletar ? new Date() : null,
      },
    });
    return r;
  });

  return NextResponse.json({ ok: true, id: String(creado.id) });
}
```

- [ ] **Step 3: Crear `app/api/trabajador/novedad/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  id_local: string;
  lote_id: string;
  numero_placa: number;
  tipo: "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
  descripcion: string;
};

function esUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const TIPOS_VALIDOS = ["PLAGA", "DANO_FISICO", "ENFERMEDAD", "OBSERVACION", "OTRO"];

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!esUuid(body.id_local)) {
    return NextResponse.json({ error: "id_local inválido" }, { status: 400 });
  }

  const existente = await prisma.novedades.findUnique({
    where: { id_local: body.id_local },
    select: { id: true },
  });
  if (existente) {
    return NextResponse.json({ ok: true, id: String(existente.id), duplicado: true });
  }

  if (!/^\d+$/.test(body.lote_id)) {
    return NextResponse.json({ error: "lote_id inválido" }, { status: 400 });
  }
  if (!Number.isInteger(body.numero_placa) || body.numero_placa < 1) {
    return NextResponse.json({ error: "numero_placa inválido" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  const descripcion = body.descripcion?.trim();
  if (!descripcion) {
    return NextResponse.json({ error: "Descripción obligatoria" }, { status: 400 });
  }

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: BigInt(body.lote_id), numero_placa: body.numero_placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol) {
    return NextResponse.json(
      { error: `No existe el árbol ${body.numero_placa} en ese lote` },
      { status: 404 },
    );
  }

  const creada = await prisma.novedades.create({
    data: {
      id_local: body.id_local,
      arbol_id: arbol.id,
      persona_id: BigInt(usuario.persona_id),
      tipo: body.tipo,
      descripcion,
      foto_path: null,
      resuelta: false,
    },
  });

  // Push a jefes (best effort)
  try {
    const ETIQUETA: Record<string, string> = {
      PLAGA: "Plaga",
      DANO_FISICO: "Daño físico",
      ENFERMEDAD: "Enfermedad",
      OBSERVACION: "Observación",
      OTRO: "Otro",
    };
    const detalle = await prisma.arboles.findUnique({
      where: { id: arbol.id },
      select: { numero_placa: true, lotes: { select: { nombre: true } } },
    });
    const jefes = await prisma.usuarios.findMany({
      where: { rol: "JEFE", activo: true },
      select: { id: true },
    });
    if (detalle && jefes.length > 0) {
      const { enviarPushAUsuarios } = await import("@/lib/push/enviar");
      await enviarPushAUsuarios(
        jefes.map((j) => j.id),
        {
          titulo: `Novedad: ${ETIQUETA[body.tipo] ?? body.tipo}`,
          cuerpo: `Árbol ${detalle.numero_placa} · Lote ${detalle.lotes.nombre}`,
          url: `/jefe/novedades/${creada.id}`,
          tag: `novedad-${creada.id}`,
        },
      );
    }
  } catch (e) {
    console.warn("Push novedad falló:", e);
  }

  return NextResponse.json({ ok: true, id: String(creada.id) });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/trabajador/
git commit -m "feat(offline): API routes idempotentes (snapshot, avance, novedad)"
```

---

## Task 8: Service Worker extendido

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Reescribir `public/sw.js` con app shell + estrategias**

```js
// Service worker para Hacienda La Zelanda — sub-fase 5.2a
// Maneja push notifications + cache de app shell para navegación offline.

const VERSION = "5.2a-1";
const CACHE_SHELL = `zelanda-shell-${VERSION}`;
const CACHE_DATOS = `zelanda-datos-${VERSION}`;

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL_URLS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((k) => k.startsWith("zelanda-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // No cachear endpoints de mutación
  if (
    url.pathname.startsWith("/api/trabajador/avance") ||
    url.pathname.startsWith("/api/trabajador/novedad") ||
    url.pathname.startsWith("/api/push") ||
    url.pathname.startsWith("/api/cron")
  ) {
    return;
  }

  // Snapshot: network-first con fallback a cache
  if (url.pathname.startsWith("/api/trabajador/snapshot")) {
    event.respondWith(networkFirst(req, CACHE_DATOS));
    return;
  }

  // Navegación HTML del trabajador → cache-first con revalidación
  if (req.mode === "navigate" && url.pathname.startsWith("/trabajador")) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
    return;
  }

  // Recursos estáticos de Next (_next/static) → cache-first
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(cacheFirst(req, CACHE_SHELL));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}

// === Push (sin cambios) ===

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { titulo: "La Zelanda", cuerpo: event.data.text() };
  }
  const titulo = payload.titulo || "La Zelanda";
  const opciones = {
    body: payload.cuerpo || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.endsWith(url) && "focus" in w) return w.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat(offline): service worker con app shell y estrategias por ruta"
```

---

## Task 9: BannerOffline + montaje en layout

**Files:**
- Create: `components/shared/BannerOffline.tsx`
- Create: `components/shared/SyncEngineInit.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Crear `components/shared/SyncEngineInit.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { SyncEngine } from "@/lib/offline/sync";

export function SyncEngineInit() {
  useEffect(() => {
    SyncEngine.init();
  }, []);
  return null;
}
```

- [ ] **Step 2: Crear `components/shared/BannerOffline.tsx`**

```tsx
"use client";

import Link from "next/link";
import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useColaPendientes } from "@/hooks/useColaPendientes";

export function BannerOffline() {
  const online = useOnlineStatus();
  const { total, errores } = useColaPendientes();

  if (online && total === 0) return null;

  let tono = "bg-zelanda-ocre-50 border-zelanda-ocre-300 text-zelanda-ocre-700";
  let Icono = CloudOff;
  let texto: string;

  if (!online && total > 0) {
    texto = `${total} pendiente${total === 1 ? "" : "s"} · Sin señal`;
  } else if (!online) {
    texto = "Sin señal";
  } else if (errores > 0) {
    tono = "bg-estado-vencida/10 border-estado-vencida/40 text-estado-vencida";
    Icono = AlertTriangle;
    texto = `${errores} con error · revisar`;
  } else {
    tono = "bg-zelanda-verde-50 border-zelanda-verde-300 text-zelanda-verde-800";
    Icono = RefreshCw;
    texto = `Sincronizando · ${total} pendiente${total === 1 ? "" : "s"}`;
  }

  const cuerpo = (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-suave ${tono}`}
    >
      <Icono className="h-3.5 w-3.5" />
      <span>{texto}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto flex max-w-screen-md justify-center px-4"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {total > 0 ? (
        <Link href="/trabajador/pendientes" aria-label="Ver pendientes">
          {cuerpo}
        </Link>
      ) : (
        cuerpo
      )}
    </div>
  );
}
```

- [ ] **Step 3: Modificar `app/(app)/layout.tsx`**

Leer el archivo primero (no se incluye aquí porque depende del estado actual). Agregar al return, al final del JSX existente y antes del cierre, ambos componentes:

```tsx
<SyncEngineInit />
<BannerOffline />
```

E importar arriba:

```tsx
import { SyncEngineInit } from "@/components/shared/SyncEngineInit";
import { BannerOffline } from "@/components/shared/BannerOffline";
```

- [ ] **Step 4: Commit**

```bash
git add components/shared/BannerOffline.tsx components/shared/SyncEngineInit.tsx app/(app)/layout.tsx
git commit -m "feat(offline): banner flotante de estado y init del sync engine"
```

---

## Task 10: Pantalla trabajador home con cache

**Files:**
- Modify: `app/(app)/trabajador/page.tsx` (renombrar/convertir)
- Create: `app/(app)/trabajador/_lista-tareas-cliente.tsx`

- [ ] **Step 1: Crear `_lista-tareas-cliente.tsx` (client component que lee cache + revalida)**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { leerAsignaciones, guardarSnapshotTrabajador, cacheFresca } from "@/lib/offline/cache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { AsignacionCacheada, SnapshotTrabajador } from "@/lib/offline/tipos";

export function ListaTareasCliente({
  nombrePila,
  snapshotInicial,
}: {
  nombrePila: string;
  snapshotInicial: SnapshotTrabajador | null;
}) {
  const online = useOnlineStatus();
  const [asignaciones, setAsignaciones] = useState<AsignacionCacheada[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      if (snapshotInicial) {
        await guardarSnapshotTrabajador(snapshotInicial);
      }
      const locales = await leerAsignaciones();
      if (!cancelado) {
        setAsignaciones(locales);
        setCargando(false);
      }
      if (online && !(await cacheFresca())) {
        try {
          const res = await fetch("/api/trabajador/snapshot");
          if (res.ok) {
            const snap = (await res.json()) as SnapshotTrabajador;
            await guardarSnapshotTrabajador(snap);
            if (!cancelado) setAsignaciones(await leerAsignaciones());
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

  return (
    <div className="space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">Trabajador</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Hola, {nombrePila}</h1>
      </header>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Mis tareas activas{" "}
          <span className="text-sm text-zelanda-verde-700">({asignaciones.length})</span>
        </h2>

        {cargando ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            Cargando…
          </p>
        ) : asignaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No tienes tareas asignadas en este momento.
          </p>
        ) : (
          <ul className="space-y-2">
            {asignaciones.map((a) => {
              const destino = a.lote_id
                ? `Lote ${a.lote_nombre}`
                : `Apiario ${a.apiario_nombre ?? "?"}`;
              const total = a.lote_id ? a.total_arboles ?? 0 : a.total_colmenas ?? 0;
              const labelDetalle = a.lote_id
                ? `${a.arboles_completados} / ${total} árboles`
                : `${total} colmenas`;
              const accion = a.estado === "EN_CURSO" ? "Continuar" : "Empezar";

              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
                >
                  <Link
                    href={`/trabajador/avance/${a.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zelanda-verde-900">{a.tipo_tarea_nombre}</p>
                      <p className="text-xs text-zelanda-verde-700">
                        {destino} · {labelDetalle}
                      </p>
                      <div className="mt-1.5">
                        <BadgeBase tono={a.estado === "EN_CURSO" ? "info" : "neutro"}>
                          {a.estado === "EN_CURSO" ? "En curso" : "Pendiente"}
                        </BadgeBase>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm font-medium text-zelanda-beige-50">
                      {accion}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-screen-md px-4 pb-2">
        <Link
          href="/trabajador/novedad/nueva"
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-zelanda-ocre-600 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-card transition hover:bg-zelanda-ocre-700"
        >
          <Plus className="h-5 w-5" />
          Reportar novedad
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reescribir `app/(app)/trabajador/page.tsx`**

```tsx
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListaTareasCliente } from "./_lista-tareas-cliente";
import type { SnapshotTrabajador } from "@/lib/offline/tipos";

export const metadata = { title: "Mis tareas" };
export const dynamic = "force-dynamic";

export default async function PaginaInicioTrabajador() {
  const usuario = await requerirUsuario("TRABAJADOR");
  const nombrePila = usuario.nombre_completo.split(" ")[0];

  let snapshot: SnapshotTrabajador | null = null;
  if (usuario.persona_id !== null) {
    const personaId = BigInt(usuario.persona_id);
    const asignaciones = await prisma.asignaciones.findMany({
      where: { persona_id: personaId, estado: { in: ["PENDIENTE", "EN_CURSO"] } },
      orderBy: { fecha_inicio: "asc" },
      include: {
        tipos_tarea: { select: { id: true, nombre: true, area: true } },
        lotes: { select: { id: true, nombre: true, total_arboles: true } },
      },
    });
    const apiarioIds = Array.from(
      new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
    );
    const apiarios = apiarioIds.length
      ? await prisma.apiarios.findMany({
          where: { id: { in: apiarioIds } },
          select: { id: true, nombre: true, total_colmenas: true },
        })
      : [];
    const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a]));
    const lotes = await prisma.lotes.findMany({
      where: { deleted_at: null, total_arboles: { gt: 0 } },
      select: { id: true, nombre: true, total_arboles: true },
      orderBy: { nombre: "asc" },
    });

    snapshot = {
      ts: new Date().toISOString(),
      lotes: lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        total_arboles: l.total_arboles,
        ts_cache: Date.now(),
      })),
      asignaciones: asignaciones.map((a) => {
        const ap = a.apiario_id ? mapaApiario.get(String(a.apiario_id)) : null;
        return {
          id: String(a.id),
          persona_id: String(a.persona_id),
          tipo_tarea_id: String(a.tipo_tarea_id),
          tipo_tarea_nombre: a.tipos_tarea.nombre,
          tipo_tarea_area: a.tipos_tarea.area,
          lote_id: a.lote_id ? String(a.lote_id) : null,
          lote_nombre: a.lotes?.nombre ?? null,
          total_arboles: a.lotes?.total_arboles ?? null,
          arboles_completados: a.arboles_completados,
          ultimo_arbol_trabajado: a.ultimo_arbol_trabajado,
          apiario_id: a.apiario_id ? String(a.apiario_id) : null,
          apiario_nombre: ap?.nombre ?? null,
          total_colmenas: ap?.total_colmenas ?? null,
          estado: a.estado,
          fecha_inicio: a.fecha_inicio.toISOString(),
          ts_cache: Date.now(),
        };
      }),
    };
  }

  return <ListaTareasCliente nombrePila={nombrePila} snapshotInicial={snapshot} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/trabajador/page.tsx app/(app)/trabajador/_lista-tareas-cliente.tsx
git commit -m "feat(offline): trabajador home lee cache local con revalidacion"
```

---

## Task 11: Form de avance con offline fallback

**Files:**
- Modify: `app/(app)/trabajador/avance/[asignacion_id]/page.tsx`
- Modify: `app/(app)/trabajador/avance/[asignacion_id]/FormAvance.tsx`
- Delete: `app/(app)/trabajador/avance/[asignacion_id]/acciones.ts` (ya no se usa; opcional borrar o dejar como referencia)

- [ ] **Step 1: Reescribir `page.tsx` para pasar datos al client component**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormAvance } from "./FormAvance";

export const metadata: Metadata = { title: "Registrar avance" };
export const dynamic = "force-dynamic";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export default async function PaginaAvance({
  params,
}: {
  params: Promise<{ asignacion_id: string }>;
}) {
  const usuario = await requerirUsuario();
  const { asignacion_id } = await params;
  const idBig = parsearId(asignacion_id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
    },
  });

  if (!a) notFound();
  if (usuario.persona_id === null || BigInt(usuario.persona_id) !== a.persona_id) notFound();
  if (a.estado !== "PENDIENTE" && a.estado !== "EN_CURSO") notFound();

  let apiarioNombre: string | null = null;
  let totalColmenas: number | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true, total_colmenas: true },
    });
    apiarioNombre = ap?.nombre ?? null;
    totalColmenas = ap?.total_colmenas ?? null;
  }

  return (
    <FormAvance
      asignacion={{
        id: String(a.id),
        tipoTarea: a.tipos_tarea.nombre,
        area: a.tipos_tarea.area,
        loteNombre: a.lotes?.nombre ?? null,
        totalArboles: a.lotes?.total_arboles ?? null,
        arbolesCompletados: a.arboles_completados,
        ultimoArbolTrabajado: a.ultimo_arbol_trabajado,
        apiarioNombre,
        totalColmenas,
      }}
    />
  );
}
```

(El page apenas cambia — sigue siendo Server Component que sirve datos al `FormAvance`.)

- [ ] **Step 2: Reescribir `FormAvance.tsx` para usar `enviarAvance`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CloudOff } from "lucide-react";
import { enviarAvance } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Asignacion = {
  id: string;
  tipoTarea: string;
  area: "CULTIVO" | "APICULTURA";
  loteNombre: string | null;
  totalArboles: number | null;
  arbolesCompletados: number;
  ultimoArbolTrabajado: number;
  apiarioNombre: string | null;
  totalColmenas: number | null;
};

function parsearListaNumeros(raw: string): number[] | null {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n <= 0) return null;
    nums.push(n);
  }
  return nums;
}

export function FormAvance({ asignacion }: { asignacion: Asignacion }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const esCultivo = asignacion.area === "CULTIVO";
  const [tipo, setTipo] = useState<"TRAMO" | "SUELTOS">("TRAMO");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

    if (!esCultivo) {
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "VISITA",
          arbol_desde: null,
          arbol_hasta: null,
          arboles_lista: [],
          observaciones,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push("/trabajador");
      });
      return;
    }

    if (tipo === "TRAMO") {
      const d = parseInt(String(formData.get("desde") ?? ""), 10);
      const h = parseInt(String(formData.get("hasta") ?? ""), 10);
      if (!Number.isInteger(d) || !Number.isInteger(h) || d < 1 || h < 1) {
        setError("Desde y hasta deben ser enteros positivos.");
        return;
      }
      if (asignacion.totalArboles && (d > asignacion.totalArboles || h > asignacion.totalArboles)) {
        setError(`Los números deben estar entre 1 y ${asignacion.totalArboles}.`);
        return;
      }
      if (d > h) {
        setError("Desde no puede ser mayor que Hasta.");
        return;
      }
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "TRAMO",
          arbol_desde: d,
          arbol_hasta: h,
          arboles_lista: [],
          observaciones,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push("/trabajador");
      });
    } else {
      const lista = parsearListaNumeros(String(formData.get("lista") ?? ""));
      if (!lista || lista.length === 0) {
        setError("Lista de números inválida o vacía.");
        return;
      }
      if (asignacion.totalArboles) {
        const fuera = lista.filter((n) => n > asignacion.totalArboles!);
        if (fuera.length > 0) {
          setError(`Algunos números superan el total (${asignacion.totalArboles}).`);
          return;
        }
      }
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "SUELTOS",
          arbol_desde: null,
          arbol_hasta: null,
          arboles_lista: lista,
          observaciones,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push("/trabajador");
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          {esCultivo ? `Lote ${asignacion.loteNombre}` : `Apiario ${asignacion.apiarioNombre}`}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{asignacion.tipoTarea}</h1>
        {esCultivo && asignacion.totalArboles !== null ? (
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Progreso: {asignacion.arbolesCompletados} / {asignacion.totalArboles} árboles
            {asignacion.ultimoArbolTrabajado > 0 ? (
              <> · último: árbol {asignacion.ultimoArbolTrabajado}</>
            ) : null}
          </p>
        ) : null}
      </header>

      {esCultivo ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("TRAMO")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "TRAMO"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Tramo
            </button>
            <button
              type="button"
              onClick={() => setTipo("SUELTOS")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "SUELTOS"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Sueltos
            </button>
          </div>

          <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
            {tipo === "TRAMO" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="desde" className={labelBase}>Desde árbol</label>
                  <input id="desde" name="desde" type="number" min="1" required className={inputBase} />
                </div>
                <div>
                  <label htmlFor="hasta" className={labelBase}>Hasta árbol</label>
                  <input id="hasta" name="hasta" type="number" min="1" required className={inputBase} />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="lista" className={labelBase}>
                  Números de árboles (separados por coma o espacio)
                </label>
                <textarea
                  id="lista"
                  name="lista"
                  rows={3}
                  required
                  placeholder="12, 45, 67, 89"
                  className={`${inputBase} min-h-[80px] resize-y`}
                />
              </div>
            )}

            <div>
              <label htmlFor="observaciones" className={labelBase}>Notas (opcional)</label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={2}
                className={`${inputBase} min-h-[60px] resize-y`}
              />
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          {asignacion.totalColmenas !== null ? (
            <p className="text-sm text-zelanda-verde-700">
              {asignacion.totalColmenas} colmenas registradas.
            </p>
          ) : null}
          <div>
            <label htmlFor="observaciones" className={labelBase}>
              Observaciones (qué se hizo, hallazgos, kg de miel, etc.)
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={4}
              required
              className={`${inputBase} min-h-[100px] resize-y`}
            />
          </div>
          <p className="text-xs text-zelanda-verde-700">
            Al registrar, la asignación queda completada.
          </p>
        </section>
      )}

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — el avance se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/trabajador"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Eliminar `acciones.ts`**

```bash
rm "app/(app)/trabajador/avance/[asignacion_id]/acciones.ts"
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/trabajador/avance/
git commit -m "feat(offline): form de avance usa cliente con fallback offline"
```

---

## Task 12: Form de novedad con offline fallback

**Files:**
- Modify: `app/(app)/trabajador/novedad/nueva/FormularioNovedad.tsx`
- Delete o ignorar: `app/(app)/trabajador/novedad/nueva/acciones.ts`

- [ ] **Step 1: Reescribir `FormularioNovedad.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CloudOff } from "lucide-react";
import { SubirFoto } from "@/components/shared/SubirFoto";
import { enviarNovedad } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Lote = { id: string; nombre: string; totalArboles: number };

export function FormularioNovedad({ lotes }: { lotes: Lote[] }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [loteId, setLoteId] = useState<string>("");
  const loteSeleccionado = lotes.find((l) => l.id === loteId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const lote = String(formData.get("lote_id") ?? "");
    const placa = parseInt(String(formData.get("numero_placa") ?? ""), 10);
    const tipo = String(formData.get("tipo") ?? "") as
      | "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
    const descripcion = String(formData.get("descripcion") ?? "").trim();

    if (!lote || !/^\d+$/.test(lote)) {
      setError("Selecciona un lote.");
      return;
    }
    if (!Number.isInteger(placa) || placa < 1) {
      setError("Número de árbol inválido.");
      return;
    }
    if (!tipo) {
      setError("Selecciona tipo de novedad.");
      return;
    }
    if (!descripcion) {
      setError("Descripción obligatoria.");
      return;
    }

    startTransition(async () => {
      const r = await enviarNovedad({
        lote_id: lote,
        numero_placa: placa,
        tipo,
        descripcion,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/trabajador");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">Reportar</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Nueva novedad</h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div>
          <label htmlFor="lote_id" className={labelBase}>Lote</label>
          <select
            id="lote_id"
            name="lote_id"
            required
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className={inputBase}
          >
            <option value="">Selecciona…</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre} ({l.totalArboles} árboles)
              </option>
            ))}
          </select>
          {lotes.length === 0 ? (
            <p className="mt-1 text-xs text-zelanda-ocre-600">
              No hay lotes con árboles cargados. Pídele al jefe que cargue árboles antes de reportar novedades.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="numero_placa" className={labelBase}>Número de árbol</label>
          <input
            id="numero_placa"
            name="numero_placa"
            type="number"
            min="1"
            max={loteSeleccionado?.totalArboles ?? undefined}
            required
            disabled={!loteSeleccionado}
            className={inputBase}
            placeholder={loteSeleccionado ? `1 a ${loteSeleccionado.totalArboles}` : "Elige lote primero"}
          />
        </div>

        <div>
          <label htmlFor="tipo" className={labelBase}>Tipo de novedad</label>
          <select id="tipo" name="tipo" required defaultValue="" className={inputBase}>
            <option value="">Selecciona…</option>
            <option value="PLAGA">Plaga</option>
            <option value="DANO_FISICO">Daño físico</option>
            <option value="ENFERMEDAD">Enfermedad</option>
            <option value="OBSERVACION">Observación</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            required
            className={`${inputBase} min-h-[80px] resize-y`}
            placeholder="Describe qué viste en el árbol"
          />
        </div>

        {online ? (
          <div>
            <label className={labelBase}>Foto (opcional)</label>
            <div className="mt-1.5">
              <SubirFoto name="foto" />
            </div>
            <p className="mt-1 text-xs text-zelanda-verde-700/70">
              La foto se subirá ahora si hay señal.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-zelanda-beige-300 bg-zelanda-beige-50 px-3 py-2 text-xs text-zelanda-verde-700">
            Sin señal — la foto solo se puede adjuntar con conexión. Podés reportar la novedad ahora; la foto la sumás después si la necesitás.
          </p>
        )}
      </section>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la novedad se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/trabajador"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente || lotes.length === 0}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Reportando…" : "Reportar"}
        </button>
      </div>
    </form>
  );
}
```

> Nota: el caso "online con foto" no usa `enviarNovedad` porque la foto necesita multipart. Para esta sub-fase, **si el usuario seleccionó foto y está online**, el form puede caer a la server action existente (`crearNovedad` en `acciones.ts`). Si no hay foto seleccionada, usa `enviarNovedad`. Esto requiere un check adicional en `onSubmit`: si `formData.get("foto")` es un File con `.size > 0`, llamar a la server action vía un `<form action={crearNovedad}>` paralelo o un endpoint multipart adicional.
>
> **Decisión simplificadora para 5.2a**: si hay foto y online, NO usar la cola — hacer POST multipart a `/api/trabajador/novedad-con-foto` (nuevo endpoint con `formData()`). Si no hay foto, usar `enviarNovedad` (JSON con id_local).

- [ ] **Step 2: Crear endpoint `/api/trabajador/novedad-con-foto/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subirFoto } from "@/lib/supabase/storage";

export async function POST(req: Request) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const lote = String(form.get("lote_id") ?? "");
  const placa = parseInt(String(form.get("numero_placa") ?? ""), 10);
  const tipo = String(form.get("tipo") ?? "");
  const descripcion = String(form.get("descripcion") ?? "").trim();
  const foto = form.get("foto");

  if (!/^\d+$/.test(lote)) return NextResponse.json({ error: "lote_id inválido" }, { status: 400 });
  if (!Number.isInteger(placa) || placa < 1)
    return NextResponse.json({ error: "numero_placa inválido" }, { status: 400 });
  if (!["PLAGA", "DANO_FISICO", "ENFERMEDAD", "OBSERVACION", "OTRO"].includes(tipo))
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  if (!descripcion) return NextResponse.json({ error: "Descripción obligatoria" }, { status: 400 });

  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: BigInt(lote), numero_placa: placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol)
    return NextResponse.json(
      { error: `No existe el árbol ${placa} en ese lote` },
      { status: 404 },
    );

  let foto_path: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const res = await subirFoto(foto, "novedades");
    foto_path = "error" in res ? null : res.path;
  }

  const creada = await prisma.novedades.create({
    data: {
      arbol_id: arbol.id,
      persona_id: BigInt(usuario.persona_id),
      tipo: tipo as never,
      descripcion,
      foto_path,
      resuelta: false,
    },
  });

  return NextResponse.json({ ok: true, id: String(creada.id) });
}
```

- [ ] **Step 3: Ajustar `onSubmit` en `FormularioNovedad.tsx` para usar el endpoint correcto según foto**

Reemplazar el bloque `startTransition` por:

```tsx
const foto = formData.get("foto");
const hayFoto = foto instanceof File && foto.size > 0;

if (hayFoto && online) {
  // Path con foto: POST multipart directo (sin cola; requiere señal)
  startTransition(async () => {
    try {
      const res = await fetch("/api/trabajador/novedad-con-foto", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as { error?: string });
        setError(j.error ?? "No se pudo reportar la novedad.");
        return;
      }
      router.push("/trabajador");
    } catch {
      setError("No se pudo enviar. Revisá la conexión.");
    }
  });
  return;
}

startTransition(async () => {
  const r = await enviarNovedad({
    lote_id: lote,
    numero_placa: placa,
    tipo,
    descripcion,
  });
  if (!r.ok) {
    setError(r.error);
    return;
  }
  router.push("/trabajador");
});
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/trabajador/novedad/ app/api/trabajador/novedad-con-foto/
git commit -m "feat(offline): form de novedad con offline fallback y path multipart"
```

---

## Task 13: Pantalla `/trabajador/pendientes`

**Files:**
- Create: `app/(app)/trabajador/pendientes/page.tsx`
- Create: `app/(app)/trabajador/pendientes/_lista-cliente.tsx`

- [ ] **Step 1: Crear `page.tsx`**

```tsx
import { requerirUsuario } from "@/lib/auth";
import { ListaPendientesCliente } from "./_lista-cliente";

export const metadata = { title: "Pendientes" };

export default async function PaginaPendientes() {
  await requerirUsuario("TRABAJADOR");
  return <ListaPendientesCliente />;
}
```

- [ ] **Step 2: Crear `_lista-cliente.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { listarTodos, borrarItem, reintentar } from "@/lib/offline/cola";
import { SyncEngine } from "@/lib/offline/sync";
import { suscribirseACambios } from "@/lib/offline/eventos";
import type { ItemColaAvance, ItemColaNovedad } from "@/lib/offline/tipos";

const ETIQUETA_NOV: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export function ListaPendientesCliente() {
  const [avances, setAvances] = useState<ItemColaAvance[]>([]);
  const [novedades, setNovedades] = useState<ItemColaNovedad[]>([]);

  useEffect(() => {
    async function refrescar() {
      const t = await listarTodos();
      setAvances(t.avances);
      setNovedades(t.novedades);
    }
    refrescar();
    return suscribirseACambios(refrescar);
  }, []);

  const items = [
    ...avances.map((a) => ({ kind: "avance" as const, ...a })),
    ...novedades.map((n) => ({ kind: "novedad" as const, ...n })),
  ].sort((a, b) => b.creado_en - a.creado_en);

  return (
    <div className="space-y-4 pb-24">
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">Sincronización</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Pendientes</h1>
      </header>

      <button
        type="button"
        onClick={() => SyncEngine.procesarCola()}
        className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-zelanda-verde-300 bg-white px-4 py-2 text-sm font-medium text-zelanda-verde-800"
      >
        <RefreshCw className="h-4 w-4" />
        Sincronizar ahora
      </button>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          No hay registros pendientes.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const titulo =
              it.kind === "avance"
                ? `Avance · ${it.tipo_registro}`
                : `Novedad · ${ETIQUETA_NOV[it.tipo] ?? it.tipo}`;
            const detalle =
              it.kind === "avance"
                ? it.tipo_registro === "TRAMO"
                  ? `Tramo ${it.arbol_desde}–${it.arbol_hasta}`
                  : it.tipo_registro === "SUELTOS"
                  ? `${it.arboles_lista.length} árbol${
                      it.arboles_lista.length === 1 ? "" : "es"
                    }`
                  : "Visita al apiario"
                : `Árbol ${it.numero_placa} · ${it.descripcion.slice(0, 60)}`;
            const fecha = new Date(it.creado_en).toLocaleString("es-CO");
            return (
              <li
                key={it.id_local}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zelanda-verde-900">{titulo}</p>
                    <p className="text-xs text-zelanda-verde-700">{detalle}</p>
                    <p className="mt-0.5 text-[11px] text-zelanda-verde-700/70">{fecha}</p>
                    {it.estado === "error_permanente" ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-estado-vencida">
                        <AlertTriangle className="h-3 w-3" />
                        {it.ultimo_error ?? "Error de sincronización"}
                      </p>
                    ) : it.estado === "subiendo" ? (
                      <p className="mt-1 text-xs text-zelanda-verde-700">Subiendo…</p>
                    ) : (
                      <p className="mt-1 text-xs text-zelanda-verde-700">Pendiente</p>
                    )}
                  </div>
                  {it.estado === "error_permanente" ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => reintentar(it.kind, it.id_local).then(() => SyncEngine.procesarCola())}
                        className="rounded-md border border-zelanda-verde-300 bg-white px-2 py-1 text-xs text-zelanda-verde-800"
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrarItem(it.kind, it.id_local)}
                        className="inline-flex items-center gap-1 rounded-md border border-estado-vencida/40 bg-white px-2 py-1 text-xs text-estado-vencida"
                      >
                        <Trash2 className="h-3 w-3" />
                        Borrar
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/trabajador/pendientes/
git commit -m "feat(offline): pantalla pendientes para revisar/reintentar/borrar items"
```

---

## Task 14: Build, lint, smoke test

- [ ] **Step 1: Verificar tipos y lint**

```bash
npm run lint
```

Esperado: sin errores. Si hay errores de tipos por el schema Prisma (campo `id_local`), correr `npx prisma generate` primero.

- [ ] **Step 2: Build**

```bash
npm run build
```

Esperado: build exitoso. Si falla por SSR (uso de `window` en código importado por server components), envolver en `if (typeof window !== "undefined")` o lazy-load.

- [ ] **Step 3: Smoke test en dev**

```bash
npm run dev
```

Probar manualmente:

1. Login como trabajador. Confirmar que `/trabajador` carga tareas.
2. Abrir DevTools → Application → IndexedDB → `zelanda-offline-v1`. Verificar stores `cache_asignaciones` y `cache_lotes` con datos.
3. DevTools → Network → throttle a "Offline".
4. Navegar a `/trabajador` recargando: debe seguir mostrando tareas (cache).
5. Entrar a una tarea, registrar TRAMO. Confirmar: redirige a `/trabajador`, banner "1 pendiente · Sin señal" aparece.
6. DevTools → Application → IndexedDB → `cola_avances`: verificar item con estado `pendiente`.
7. Volver Network a "Online". Esperar 1-2 segundos.
8. Confirmar banner desaparece. `cola_avances` vacía. En BD (Supabase Studio o admin), el `registros_avance` aparece con `id_local` poblado.
9. Crear novedad sin foto offline. Mismo flujo.
10. Crear novedad con foto online: confirmar foto sube vía `/api/trabajador/novedad-con-foto`.

- [ ] **Step 4: Probar idempotencia**

Con DevTools abierto, dispará 2 veces el mismo POST manualmente (mismo `id_local`). Esperado: segundo retorna `{ ok: true, duplicado: true }`, BD no tiene duplicado.

- [ ] **Step 5: Probar error permanente**

Modificar temporalmente el endpoint avance para retornar 400 en TRAMO. Registrar TRAMO → ver que pasa a `error_permanente` → ver en `/trabajador/pendientes` → reintentar / borrar funcionan. Revertir cambio.

- [ ] **Step 6: Commit final si hubo ajustes**

```bash
git add -u
git commit -m "fix(offline): ajustes post-smoke test"
```

---

## Task 15: Documentación final

**Files:**
- Modify: `CLAUDE.md`
- Modify: `MEMORY.md` (opcional, vía auto-memory)

- [ ] **Step 1: Actualizar sección §9 Hoja de ruta en `CLAUDE.md`**

En la sección Fase 5, marcar:

```markdown
### Fase 5 — Apicultura y refinamientos
- Módulo de apiarios (pendiente)
- Tareas de apicultura (pendiente)
- Modo offline trabajador (5.2a) ✅
- Modo offline bodega/almacén/jefe (5.2b, pendiente)
- Fotos offline (5.2c, pendiente)
- Notificaciones push ✅
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marcar sub-fase 5.2a (offline trabajador) como completada"
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Manual pending (no en tareas)

Cosas que el usuario hace fuera del flujo de código:

1. Aplicar `supabase/migracion-fase5-offline-trabajador.sql` en Supabase SQL Editor del proyecto.
2. Después de aplicar, en local correr `npm run db:generate` para refrescar el cliente Prisma.
3. Tras deploy a Vercel: probar PWA en iOS standalone + Android Chrome con airplane mode encendido / apagado.

---

## Resumen

- 15 tareas (incluyendo migración y docs).
- ~5-7 horas de implementación con subagents.
- Sin dependencias nuevas pesadas (solo `idb`, 1KB).
- Cero cambios en BD destructivos (solo agrega columnas nullable).
- Backwards compatible: registros sin `id_local` siguen funcionando.
