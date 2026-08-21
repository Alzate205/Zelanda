import {
  listarPendientesPorTipo,
  marcarSubiendo,
  marcarSubido,
  marcarFallidoTemp,
  marcarErrorPermanente,
  reclamarSubiendo,
  TIPOS_COLA,
  type TipoCola,
} from './cola';
import type {
  ItemColaAvance,
  ItemColaNovedad,
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
} from './tipos';
import { captureException } from '@/lib/sentry';
import { clasificarRespuesta } from './clasificar';
import { esDeLaSesion, usuarioLocal } from './sesion';
import { llevaFoto, resolverFotoDeItem } from './foto';

/** Lo que pasó en una corrida, para poder decírselo al que apretó el botón. */
export type ResumenSync = {
  subidos: number;
  pendientes: number;
  fallidos: number;
  ultimoError: string | null;
  sinSenal: boolean;
  /** Items encolados por otra cuenta en este mismo celular: no se tocan. */
  ajenos: number;
};

const MAX_INTENTOS = 5;
const CONCURRENCIA_POR_TIPO = 3;

async function procesarEnParalelo<T>(
  items: T[],
  concurrencia: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const enVuelo = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).finally(() => {
      enVuelo.delete(p);
    });
    enVuelo.add(p);
    if (enVuelo.size >= concurrencia) {
      await Promise.race(enVuelo);
    }
  }
  await Promise.all(enVuelo);
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
    estado_apiario: i.estado_apiario,
    foto_path: i.foto_path ?? null,
  };
}

function payloadNovedad(i: ItemColaNovedad) {
  return {
    id_local: i.id_local,
    lote_id: i.lote_id,
    numero_placa: i.numero_placa,
    tipo: i.tipo,
    descripcion: i.descripcion,
    foto_path: i.foto_path ?? null,
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
  return {
    id_local: i.id_local,
    despacho_id: i.despacho_id,
    lote_id: i.lote_id ?? null,
    items: i.items,
  };
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
    asignacion_id: i.asignacion_id ?? null,
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
    case 'avance':
      return '/api/trabajador/avance';
    case 'novedad':
      return '/api/trabajador/novedad';
    case 'despacho_crear':
      return '/api/bodega/despacho/crear';
    case 'despacho_cerrar':
      return '/api/bodega/despacho/cerrar';
    case 'cosecha':
      return '/api/almacen/cosecha';
    case 'salida':
      return '/api/almacen/salida';
  }
}

function payloadDeItem(tipo: TipoCola, item: unknown): unknown {
  switch (tipo) {
    case 'avance':
      return payloadAvance(item as ItemColaAvance);
    case 'novedad':
      return payloadNovedad(item as ItemColaNovedad);
    case 'despacho_crear':
      return payloadDespachoCrear(item as ItemColaDespachoCrear);
    case 'despacho_cerrar':
      return payloadDespachoCerrar(item as ItemColaDespachoCerrar);
    case 'cosecha':
      return payloadCosecha(item as ItemColaCosecha);
    case 'salida':
      return payloadSalida(item as ItemColaSalida);
  }
}

class SyncEngineImpl {
  /** La corrida en curso, si la hay. Quien llega en medio se cuelga de ella. */
  private corriendo: Promise<ResumenSync> | null = null;
  private inicializado = false;

  init(): void {
    if (typeof window === 'undefined' || this.inicializado) return;
    this.inicializado = true;
    window.addEventListener('online', () => {
      this.procesarCola().catch((e) => {
        try {
          captureException(e);
        } catch {}
      });
    });
    if (navigator.onLine) {
      this.procesarCola().catch((e) => {
        try {
          captureException(e);
        } catch {}
      });
    }
  }

  /**
   * Vacía la cola y cuenta qué pasó. Si ya hay una corrida en curso devuelve
   * esa misma promesa: apretar el botón dos veces no debe contestar "nada".
   */
  procesarCola(): Promise<ResumenSync> {
    if (this.corriendo) return this.corriendo;
    const corrida = this.correr().finally(() => {
      this.corriendo = null;
    });
    this.corriendo = corrida;
    return corrida;
  }

  private async correr(): Promise<ResumenSync> {
    const resumen: ResumenSync = {
      subidos: 0,
      pendientes: 0,
      fallidos: 0,
      ultimoError: null,
      sinSenal: false,
      ajenos: 0,
    };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      resumen.sinSenal = true;
      return resumen;
    }
    // Lo que quedó a medio subir de una corrida anterior vuelve a la cola:
    // si no, se queda en "subiendo" y no lo reintenta nadie.
    await reclamarSubiendo();
    for (const tipo of TIPOS_COLA) {
      await this.procesarTipo(tipo, resumen);
    }
    return resumen;
  }

  private async procesarTipo(tipo: TipoCola, resumen: ResumenSync): Promise<void> {
    const todos = await listarPendientesPorTipo(tipo);
    const actual = usuarioLocal();
    // Subir con la sesión de hoy lo que encoló otra cuenta se lo atribuiría a
    // quien está adentro ahora. Eso espera a que su dueño vuelva a entrar.
    const items = todos.filter((i) => esDeLaSesion(i.usuario_id, actual));
    resumen.ajenos += todos.length - items.length;
    await procesarEnParalelo(items, CONCURRENCIA_POR_TIPO, (item) =>
      this.procesarItem(tipo, item, resumen)
    );
  }

  private async procesarItem(
    tipo: TipoCola,
    item: { id_local: string; intentos: number; ultimo_error: string | null } & object,
    resumen: ResumenSync
  ): Promise<void> {
    if (item.intentos >= MAX_INTENTOS) {
      const error = item.ultimo_error ?? 'Máximo de reintentos';
      await marcarErrorPermanente(tipo, item.id_local, error);
      resumen.fallidos += 1;
      resumen.ultimoError = error;
      return;
    }
    await marcarSubiendo(tipo, item.id_local);
    try {
      // La foto va primero: el registro no se manda hasta que ella tenga path,
      // porque mandarlo antes lo dejaría para siempre sin la foto que se tomó.
      let conFoto: object = item;
      if (llevaFoto(tipo)) {
        const r = await resolverFotoDeItem(tipo, item.id_local);
        if (!r.ok) {
          await marcarFallidoTemp(tipo, item.id_local, r.error);
          resumen.pendientes += 1;
          resumen.ultimoError = r.error;
          return;
        }
        conFoto = { ...item, foto_path: r.foto_path };
      }
      const body = payloadDeItem(tipo, conFoto);
      const res = await fetch(endpointPara(tipo), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const clase = clasificarRespuesta(res.status);
      if (clase === 'ok') {
        await marcarSubido(tipo, item.id_local);
        resumen.subidos += 1;
      } else if (clase === 'permanente') {
        const j = await res.json().catch(() => ({} as { error?: string }));
        const error = j.error ?? `HTTP ${res.status}`;
        await marcarErrorPermanente(tipo, item.id_local, error);
        resumen.fallidos += 1;
        resumen.ultimoError = error;
      } else {
        const error = `HTTP ${res.status}`;
        await marcarFallidoTemp(tipo, item.id_local, error);
        resumen.pendientes += 1;
        resumen.ultimoError = error;
      }
    } catch (e) {
      try {
        captureException(e);
      } catch {}
      const error = (e as Error).message;
      await marcarFallidoTemp(tipo, item.id_local, error);
      resumen.pendientes += 1;
      resumen.ultimoError = error;
    }
  }
}

export const SyncEngine = new SyncEngineImpl();
