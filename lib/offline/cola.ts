import { abrirDb, type ZelandaOfflineDB } from './db';
import { emitirCambio } from './eventos';
import { esDeLaSesion, usuarioLocal } from './sesion';
import type {
  ItemColaAvance,
  ItemColaNovedad,
  ItemColaDespachoCrear,
  ItemColaDespachoCerrar,
  ItemColaCosecha,
  ItemColaSalida,
} from './tipos';

export type TipoCola =
  | 'avance'
  | 'novedad'
  | 'despacho_crear'
  | 'despacho_cerrar'
  | 'cosecha'
  | 'salida';

/** Todos los tipos de cola, en el orden en que se procesan. */
export const TIPOS_COLA: TipoCola[] = [
  'avance',
  'novedad',
  'despacho_crear',
  'despacho_cerrar',
  'cosecha',
  'salida',
];

type ItemCola =
  | ItemColaAvance
  | ItemColaNovedad
  | ItemColaDespachoCrear
  | ItemColaDespachoCerrar
  | ItemColaCosecha
  | ItemColaSalida;

type StoreCola = keyof Pick<
  ZelandaOfflineDB,
  | 'cola_avances'
  | 'cola_novedades'
  | 'cola_despachos_crear'
  | 'cola_despachos_cerrar'
  | 'cola_cosechas'
  | 'cola_salidas'
>;

function nombreStore(t: TipoCola): StoreCola {
  switch (t) {
    case 'avance':
      return 'cola_avances';
    case 'novedad':
      return 'cola_novedades';
    case 'despacho_crear':
      return 'cola_despachos_crear';
    case 'despacho_cerrar':
      return 'cola_despachos_cerrar';
    case 'cosecha':
      return 'cola_cosechas';
    case 'salida':
      return 'cola_salidas';
  }
}

/**
 * Marca el item con la sesión que lo creó antes de guardarlo.
 *
 * La cola vive en el celular y no en la cuenta, así que sin esta marca lo que
 * encoló una persona terminaba subiéndose con las cookies de la siguiente que
 * entrara en ese mismo teléfono.
 */
function conDueno<T extends { usuario_id?: string | null }>(item: T): T {
  return { ...item, usuario_id: item.usuario_id ?? usuarioLocal() };
}

export async function encolarAvance(item: ItemColaAvance): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_avances', conDueno(item));
  emitirCambio();
}

export async function encolarNovedad(item: ItemColaNovedad): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_novedades', conDueno(item));
  emitirCambio();
}

export async function encolarDespachoCrear(item: ItemColaDespachoCrear): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_despachos_crear', conDueno(item));
  emitirCambio();
}

export async function encolarDespachoCerrar(item: ItemColaDespachoCerrar): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_despachos_cerrar', conDueno(item));
  emitirCambio();
}

export async function encolarCosecha(item: ItemColaCosecha): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_cosechas', conDueno(item));
  emitirCambio();
}

export async function encolarSalida(item: ItemColaSalida): Promise<void> {
  const db = await abrirDb();
  await db.put('cola_salidas', conDueno(item));
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
  tipo: T
): Promise<ItemPorTipo[T][]> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const items = await db.getAllFromIndex(store, 'por_estado', 'pendiente');
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
      db.getAll('cola_avances'),
      db.getAll('cola_novedades'),
      db.getAll('cola_despachos_crear'),
      db.getAll('cola_despachos_cerrar'),
      db.getAll('cola_cosechas'),
      db.getAll('cola_salidas'),
    ]);
  return { avances, novedades, despachos_crear, despachos_cerrar, cosechas, salidas };
}

/**
 * Lo mismo que listarTodos(), pero solo lo de la sesión que está adentro.
 * Es lo que deben mostrar las pantallas de Pendientes: nadie puede resolver
 * —ni tiene por qué ver— el trabajo que dejó otra cuenta en este celular.
 */
export async function listarTodosDeLaSesion(): Promise<Awaited<ReturnType<typeof listarTodos>>> {
  const todos = await listarTodos();
  const actual = usuarioLocal();
  const mio = <T extends { usuario_id?: string | null }>(items: T[]) =>
    items.filter((i) => esDeLaSesion(i.usuario_id, actual));
  return {
    avances: mio(todos.avances),
    novedades: mio(todos.novedades),
    despachos_crear: mio(todos.despachos_crear),
    despachos_cerrar: mio(todos.despachos_cerrar),
    cosechas: mio(todos.cosechas),
    salidas: mio(todos.salidas),
  };
}

export async function contarVisibles(): Promise<number> {
  const todos = await listarTodos();
  const actual = usuarioLocal();
  // Lo que dejó pendiente otra cuenta en este celular no es asunto de quien
  // está adentro ahora: contarlo le mostraba un pendiente que no puede resolver.
  const visibles = (i: ItemCola) =>
    esDeLaSesion(i.usuario_id, actual) &&
    (i.estado === 'pendiente' || i.estado === 'subiendo' || i.estado === 'error_permanente');
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
  const actual = usuarioLocal();
  const esError = (i: ItemCola) =>
    esDeLaSesion(i.usuario_id, actual) && i.estado === 'error_permanente';
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
  parche: Partial<ItemCola>
): Promise<void> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const actual = await db.get(store, id_local);
  if (!actual) return;
  await db.put(store, { ...actual, ...parche } as ItemCola);
  emitirCambio();
}

/**
 * Escribe campos sueltos de un item sin tocar su estado en la cola.
 * Lo usa la subida de fotos para guardar el path ya resuelto (y soltar el blob)
 * antes de mandar el registro.
 */
export async function parchearItem(
  tipo: TipoCola,
  id_local: string,
  parche: Partial<ItemCola>
): Promise<void> {
  await actualizarEstado(tipo, id_local, parche);
}

export async function marcarSubiendo(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: 'subiendo' });
}

export async function marcarSubido(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: 'subido' });
  // Borrar tras 5s para dejar feedback breve
  setTimeout(() => borrarItem(tipo, id_local).catch(() => undefined), 5000);
}

export async function marcarFallidoTemp(
  tipo: TipoCola,
  id_local: string,
  error: string
): Promise<void> {
  const db = await abrirDb();
  const store = nombreStore(tipo);
  const actual = await db.get(store, id_local);
  if (!actual) return;
  await db.put(store, {
    ...actual,
    estado: 'pendiente',
    intentos: actual.intentos + 1,
    ultimo_error: error,
  } as ItemCola);
  emitirCambio();
}

export async function marcarErrorPermanente(
  tipo: TipoCola,
  id_local: string,
  error: string
): Promise<void> {
  await actualizarEstado(tipo, id_local, { estado: 'error_permanente', ultimo_error: error });
}

/**
 * Devuelve a la cola lo que quedó marcado como "subiendo".
 *
 * Un item se marca "subiendo" justo antes de mandarlo. Si el celular navega a
 * otra pantalla, se cierra la app o se apaga en ese momento, la subida se
 * aborta y nadie vuelve a escribir su estado: el item queda en "subiendo" para
 * siempre, y como la cola solo reintenta lo que está "pendiente", ese registro
 * —con su foto— no se sube nunca más.
 *
 * Se llama al empezar cada corrida, cuando por definición no hay ninguna
 * subida nuestra en vuelo. Reintentar de más es inofensivo: el servidor
 * descarta los duplicados por `id_local`.
 */
export async function reclamarSubiendo(): Promise<number> {
  const db = await abrirDb();
  let reclamados = 0;
  for (const tipo of TIPOS_COLA) {
    const store = nombreStore(tipo);
    const varados = await db.getAllFromIndex(store, 'por_estado', 'subiendo');
    for (const item of varados) {
      await db.put(store, { ...item, estado: 'pendiente' } as ItemCola);
      reclamados += 1;
    }
  }
  if (reclamados > 0) emitirCambio();
  return reclamados;
}

export async function reintentar(tipo: TipoCola, id_local: string): Promise<void> {
  await actualizarEstado(tipo, id_local, {
    estado: 'pendiente',
    intentos: 0,
    ultimo_error: null,
  });
}

export async function borrarItem(tipo: TipoCola, id_local: string): Promise<void> {
  const db = await abrirDb();
  await db.delete(nombreStore(tipo), id_local);
  emitirCambio();
}
