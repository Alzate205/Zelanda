import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  AsignacionCacheada,
  LoteCacheado,
  MetaCache,
  ItemColaAvance,
  ItemColaNovedad,
  SnapshotBodega,
  SnapshotAlmacen,
  SnapshotJefe,
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
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
  cache_bodega: { key: string; value: { key: string; data: SnapshotBodega; ts_cache: number } };
  cache_almacen: { key: string; value: { key: string; data: SnapshotAlmacen; ts_cache: number } };
  cache_jefe: { key: string; value: { key: string; data: SnapshotJefe; ts_cache: number } };
  cola_despachos_crear: {
    key: string;
    value: ItemColaDespachoCrear;
    indexes: { por_estado: string };
  };
  cola_despachos_cerrar: {
    key: string;
    value: ItemColaDespachoCerrar;
    indexes: { por_estado: string };
  };
  cola_cosechas: {
    key: string;
    value: ItemColaCosecha;
    indexes: { por_estado: string };
  };
  cola_salidas: {
    key: string;
    value: ItemColaSalida;
    indexes: { por_estado: string };
  };
}

const NOMBRE_DB = "zelanda-offline-v1";
const VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ZelandaOfflineDB>> | null = null;

export function abrirDb(): Promise<IDBPDatabase<ZelandaOfflineDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible en server"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ZelandaOfflineDB>(NOMBRE_DB, VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
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
          for (const nombre of [
            "cola_despachos_crear",
            "cola_despachos_cerrar",
            "cola_cosechas",
            "cola_salidas",
          ] as const) {
            if (!db.objectStoreNames.contains(nombre)) {
              const s = db.createObjectStore(nombre, { keyPath: "id_local" });
              s.createIndex("por_estado", "estado");
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

export type { ZelandaOfflineDB };
