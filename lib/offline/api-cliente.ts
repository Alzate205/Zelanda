import { generarUuid } from "./uuid";
import {
  encolarAvance,
  encolarNovedad,
  encolarDespachoCrear,
  encolarDespachoCerrar,
  encolarCosecha,
  encolarSalida,
  marcarErrorPermanente,
  marcarSubido,
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
export type PayloadDespachoCrear = Omit<
  ItemColaDespachoCrear,
  "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en"
>;
export type PayloadDespachoCerrar = Omit<
  ItemColaDespachoCerrar,
  "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en"
>;
export type PayloadCosecha = Omit<
  ItemColaCosecha,
  "id_local" | "estado" | "intentos" | "ultimo_error" | "creado_en"
>;
export type PayloadSalida = Omit<
  ItemColaSalida,
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
  return intentarSubirGenerico("/api/trabajador/avance", { ...payload, id_local }, "avance", id_local);
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
  return intentarSubirGenerico(
    "/api/trabajador/novedad",
    { ...payload, id_local },
    "novedad",
    id_local,
  );
}

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
  return intentarSubirGenerico(
    "/api/bodega/despacho/crear",
    { ...payload, id_local },
    "despacho_crear",
    id_local,
  );
}

export async function enviarDespachoCerrar(payload: PayloadDespachoCerrar): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaDespachoCerrar = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarDespachoCerrar(item);
  return intentarSubirGenerico(
    "/api/bodega/despacho/cerrar",
    { ...payload, id_local },
    "despacho_cerrar",
    id_local,
  );
}

export async function enviarCosecha(payload: PayloadCosecha): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaCosecha = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarCosecha(item);
  return intentarSubirGenerico(
    "/api/almacen/cosecha",
    { ...payload, id_local },
    "cosecha",
    id_local,
  );
}

export async function enviarSalida(payload: PayloadSalida): Promise<Resultado> {
  const id_local = generarUuid();
  const item: ItemColaSalida = {
    ...payload,
    id_local,
    estado: "pendiente",
    intentos: 0,
    ultimo_error: null,
    creado_en: Date.now(),
  };
  await encolarSalida(item);
  return intentarSubirGenerico(
    "/api/almacen/salida",
    { ...payload, id_local },
    "salida",
    id_local,
  );
}

async function intentarSubirGenerico(
  url: string,
  body: unknown,
  tipo: TipoCola,
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
