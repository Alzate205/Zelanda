import { abrirDb } from "./db";
import type {
  AsignacionCacheada,
  LoteCacheado,
  SnapshotTrabajador,
  SnapshotBodega,
  SnapshotAlmacen,
  SnapshotJefe,
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

// === Snapshots por rol (bodega / almacen / jefe) ===

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
