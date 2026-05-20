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
