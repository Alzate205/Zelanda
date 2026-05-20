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
