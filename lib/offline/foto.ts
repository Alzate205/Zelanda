import { abrirDb } from './db';
import { parchearItem, type TipoCola } from './cola';
import { clasificarRespuesta } from './clasificar';

/** Solo estos dos tipos de registro llevan foto. */
type TipoConFoto = Extract<TipoCola, 'avance' | 'novedad'>;

const CARPETA: Record<TipoConFoto, 'avance' | 'novedades'> = {
  avance: 'avance',
  novedad: 'novedades',
};

const STORE: Record<TipoConFoto, 'cola_avances' | 'cola_novedades'> = {
  avance: 'cola_avances',
  novedad: 'cola_novedades',
};

export function llevaFoto(tipo: TipoCola): tipo is TipoConFoto {
  return tipo === 'avance' || tipo === 'novedad';
}

export type ResultadoFoto = { ok: true; foto_path: string | null } | { ok: false; error: string };

/**
 * Sube la foto que quedó guardada junto al registro, si todavía no está subida.
 *
 * La foto se guarda como blob en IndexedDB al momento de tomarla, sin importar
 * si hay señal: en el campo casi nunca la hay. Esta función es la que la
 * convierte en un path del storage cuando por fin se puede.
 *
 * Si la subida falla por señal o por el servidor, devuelve error y el registro
 * entero se reintenta después: la foto no se pierde. Si falla de forma
 * definitiva (la foto no es válida o pesa demasiado), suelta el blob y deja que
 * el registro suba sin foto, con el motivo anotado — perder el trabajo del día
 * por una foto rota sería peor.
 */
export async function resolverFotoDeItem(
  tipo: TipoConFoto,
  id_local: string
): Promise<ResultadoFoto> {
  const db = await abrirDb();
  const item = await db.get(STORE[tipo], id_local);
  if (!item) return { ok: true, foto_path: null };
  if (item.foto_path) return { ok: true, foto_path: item.foto_path };
  const blob = item.foto_blob;
  if (!blob) return { ok: true, foto_path: null };

  const fd = new FormData();
  fd.append('carpeta', CARPETA[tipo]);
  fd.append('foto', blob, item.foto_nombre ?? 'foto.jpg');

  let res: Response;
  try {
    res = await fetch('/api/trabajador/foto', { method: 'POST', body: fd });
  } catch {
    return { ok: false, error: 'No se pudo subir la foto todavía.' };
  }

  const clase = clasificarRespuesta(res.status);
  if (clase === 'ok') {
    const j = (await res.json().catch(() => ({}))) as { path?: string };
    if (!j.path) return { ok: false, error: 'No se pudo subir la foto todavía.' };
    await parchearItem(tipo, id_local, { foto_path: j.path, foto_blob: null });
    return { ok: true, foto_path: j.path };
  }

  if (clase === 'permanente') {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    await parchearItem(tipo, id_local, {
      foto_blob: null,
      ultimo_error: `La foto no se pudo guardar (${
        j.error ?? `HTTP ${res.status}`
      }). El registro sube sin foto.`,
    });
    return { ok: true, foto_path: null };
  }

  return { ok: false, error: `No se pudo subir la foto (HTTP ${res.status}).` };
}
