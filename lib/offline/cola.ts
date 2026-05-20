import { abrirDb } from "./db";
import { emitirCambio } from "./eventos";
import type {
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
