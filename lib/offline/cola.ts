import { abrirDb, type ZelandaOfflineDB } from "./db";
import { emitirCambio } from "./eventos";
import type {
  ItemColaAvance,
  ItemColaNovedad,
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
} from "./tipos";

export type TipoCola =
  | "avance"
  | "novedad"
  | "despacho_crear"
  | "despacho_cerrar"
  | "cosecha"
  | "salida";

type ItemCola =
  | ItemColaAvance
  | ItemColaNovedad
  | ItemColaDespachoCrear
  | ItemColaDespachoCerrar
  | ItemColaCosecha
  | ItemColaSalida;

type StoreCola = keyof Pick<
  ZelandaOfflineDB,
  | "cola_avances"
  | "cola_novedades"
  | "cola_despachos_crear"
  | "cola_despachos_cerrar"
  | "cola_cosechas"
  | "cola_salidas"
>;

function nombreStore(t: TipoCola): StoreCola {
  switch (t) {
    case "avance":
      return "cola_avances";
    case "novedad":
      return "cola_novedades";
    case "despacho_crear":
      return "cola_despachos_crear";
    case "despacho_cerrar":
      return "cola_despachos_cerrar";
    case "cosecha":
      return "cola_cosechas";
    case "salida":
      return "cola_salidas";
  }
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

export async function encolarDespachoCrear(item: ItemColaDespachoCrear): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_despachos_crear", item);
  emitirCambio();
}

export async function encolarDespachoCerrar(item: ItemColaDespachoCerrar): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_despachos_cerrar", item);
  emitirCambio();
}

export async function encolarCosecha(item: ItemColaCosecha): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_cosechas", item);
  emitirCambio();
}

export async function encolarSalida(item: ItemColaSalida): Promise<void> {
  const db = await abrirDb();
  await db.put("cola_salidas", item);
  emitirCambio();
}

type ItemPorTipo = {
  avance: ItemColaAvance;
  novedad: ItemColaNovedad;
  despacho_crear: ItemColaDespachoCrear;
  despacho_cerrar: ItemColaDespachoCerrar;
  cosecha: ItemColaCosecha;
  salida: ItemColaSalida;
};

export async function listarPendientesPorTipo<T extends TipoCola>(
  tipo: T,
): Promise<ItemPorTipo[T][]> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const items = await db.getAllFromIndex(store, "por_estado", "pendiente");
  return items as unknown as ItemPorTipo[T][];
}

export async function listarTodos(): Promise<{
  avances: ItemColaAvance[];
  novedades: ItemColaNovedad[];
  despachos_crear: ItemColaDespachoCrear[];
  despachos_cerrar: ItemColaDespachoCerrar[];
  cosechas: ItemColaCosecha[];
  salidas: ItemColaSalida[];
}> {
  const db = await abrirDb();
  const [avances, novedades, despachos_crear, despachos_cerrar, cosechas, salidas] =
    await Promise.all([
      db.getAll("cola_avances"),
      db.getAll("cola_novedades"),
      db.getAll("cola_despachos_crear"),
      db.getAll("cola_despachos_cerrar"),
      db.getAll("cola_cosechas"),
      db.getAll("cola_salidas"),
    ]);
  return { avances, novedades, despachos_crear, despachos_cerrar, cosechas, salidas };
}

export async function contarVisibles(): Promise<number> {
  const todos = await listarTodos();
  const visibles = (i: ItemCola) =>
    i.estado === "pendiente" || i.estado === "subiendo" || i.estado === "error_permanente";
  return (
    todos.avances.filter(visibles).length +
    todos.novedades.filter(visibles).length +
    todos.despachos_crear.filter(visibles).length +
    todos.despachos_cerrar.filter(visibles).length +
    todos.cosechas.filter(visibles).length +
    todos.salidas.filter(visibles).length
  );
}

export async function contarErrores(): Promise<number> {
  const todos = await listarTodos();
  const esError = (i: ItemCola) => i.estado === "error_permanente";
  return (
    todos.avances.filter(esError).length +
    todos.novedades.filter(esError).length +
    todos.despachos_crear.filter(esError).length +
    todos.despachos_cerrar.filter(esError).length +
    todos.cosechas.filter(esError).length +
    todos.salidas.filter(esError).length
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
