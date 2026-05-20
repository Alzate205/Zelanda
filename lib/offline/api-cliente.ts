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
