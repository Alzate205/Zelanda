import {
  listarPendientesPorTipo,
  marcarSubiendo,
  marcarSubido,
  marcarFallidoTemp,
  marcarErrorPermanente,
  type TipoCola,
} from "./cola";
import type {
  ItemColaAvance,
  ItemColaNovedad,
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
} from "./tipos";

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

function endpointPara(tipo: TipoCola): string {
  switch (tipo) {
    case "avance":
      return "/api/trabajador/avance";
    case "novedad":
      return "/api/trabajador/novedad";
    case "despacho_crear":
      return "/api/bodega/despacho/crear";
    case "despacho_cerrar":
      return "/api/bodega/despacho/cerrar";
    case "cosecha":
      return "/api/almacen/cosecha";
    case "salida":
      return "/api/almacen/salida";
  }
}

function payloadDeItem(tipo: TipoCola, item: unknown): unknown {
  switch (tipo) {
    case "avance":
      return payloadAvance(item as ItemColaAvance);
    case "novedad":
      return payloadNovedad(item as ItemColaNovedad);
    case "despacho_crear":
      return payloadDespachoCrear(item as ItemColaDespachoCrear);
    case "despacho_cerrar":
      return payloadDespachoCerrar(item as ItemColaDespachoCerrar);
    case "cosecha":
      return payloadCosecha(item as ItemColaCosecha);
    case "salida":
      return payloadSalida(item as ItemColaSalida);
  }
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
      await this.procesarTipo("despacho_crear");
      await this.procesarTipo("despacho_cerrar");
      await this.procesarTipo("cosecha");
      await this.procesarTipo("salida");
    } finally {
      this.corriendo = false;
    }
  }

  private async procesarTipo(tipo: TipoCola): Promise<void> {
    const items = await listarPendientesPorTipo(tipo);
    for (const item of items) {
      if (item.intentos >= MAX_INTENTOS) {
        await marcarErrorPermanente(
          tipo,
          item.id_local,
          item.ultimo_error ?? "Máximo de reintentos",
        );
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
}

export const SyncEngine = new SyncEngineImpl();
