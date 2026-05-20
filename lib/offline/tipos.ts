// Tipos compartidos para cache y cola offline.

export type AreaTarea = "CULTIVO" | "APICULTURA";
export type EstadoAsignacion = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
export type TipoRegistro = "TRAMO" | "SUELTOS" | "VISITA";
export type TipoNovedad = "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
export type EstadoCola = "pendiente" | "subiendo" | "subido" | "error_permanente";

export type AsignacionCacheada = {
  id: string;
  persona_id: string;
  tipo_tarea_id: string;
  tipo_tarea_nombre: string;
  tipo_tarea_area: AreaTarea;
  lote_id: string | null;
  lote_nombre: string | null;
  total_arboles: number | null;
  arboles_completados: number;
  ultimo_arbol_trabajado: number;
  apiario_id: string | null;
  apiario_nombre: string | null;
  total_colmenas: number | null;
  estado: EstadoAsignacion;
  fecha_inicio: string;
  ts_cache: number;
};

export type LoteCacheado = {
  id: string;
  nombre: string;
  total_arboles: number;
  ts_cache: number;
};

export type MetaCache = { key: string; value: unknown };

export type ItemColaAvance = {
  id_local: string;
  asignacion_id: string;
  tipo_registro: TipoRegistro;
  arbol_desde: number | null;
  arbol_hasta: number | null;
  arboles_lista: number[];
  observaciones: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaNovedad = {
  id_local: string;
  lote_id: string;
  numero_placa: number;
  tipo: TipoNovedad;
  descripcion: string;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type SnapshotTrabajador = {
  asignaciones: AsignacionCacheada[];
  lotes: LoteCacheado[];
  ts: string;
};

// === Bodega ===

export type HerramientaCacheada = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  total: number;
  prestadas: number;
  disponibles: number;
};

export type InsumoCacheado = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
  stock_disponible: number;
};

export type PersonaCacheada = {
  id: string;
  nombre: string;
};

export type AsignacionResumenCacheada = {
  id: string;
  persona_id: string;
  etiqueta: string;
};

export type DespachoAbiertoItem = {
  id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  nombre: string;
  unidad: string;
  cantidad: number;
};

export type DespachoAbiertoCacheado = {
  id: string;
  persona_nombre: string;
  fecha_despacho: string;
  items: DespachoAbiertoItem[];
};

export type SnapshotBodega = {
  herramientas: HerramientaCacheada[];
  insumos: InsumoCacheado[];
  personas: PersonaCacheada[];
  asignaciones: AsignacionResumenCacheada[];
  despachos_abiertos: DespachoAbiertoCacheado[];
  ts: string;
};

// === Almacén ===

export type LoteParaCosecha = {
  id: string;
  nombre: string;
  total_arboles: number;
};

export type SnapshotAlmacen = {
  lotes: LoteParaCosecha[];
  personas: PersonaCacheada[];
  stock_almacen_kg: number;
  ts: string;
};

// === Jefe ===

export type LoteJefe = {
  id: string;
  nombre: string;
  total_arboles: number;
  tareas_proximas: number;
  tareas_vencidas: number;
  novedades_abiertas: number;
};

export type AsignacionJefe = {
  id: string;
  tipo_tarea_nombre: string;
  persona_nombre: string;
  lote_nombre: string | null;
  apiario_nombre: string | null;
  estado: string;
  fecha_inicio: string;
  arboles_completados: number;
  total_arboles: number | null;
};

export type NovedadJefe = {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  arbol_numero: number;
  lote_nombre: string;
  persona_nombre: string;
  resuelta: boolean;
};

export type AlertaJefe = {
  tipo: "TAREA_VENCIDA" | "TAREA_PROXIMA" | "STOCK_BAJO" | "DESPACHO_ABIERTO" | "NOVEDAD_CRITICA";
  texto: string;
  url: string;
  fecha: string;
};

export type SnapshotJefe = {
  lotes: LoteJefe[];
  asignaciones: AsignacionJefe[];
  novedades: NovedadJefe[];
  alertas: AlertaJefe[];
  ts: string;
};

// === Items de cola nuevos ===

export type ItemColaDespachoCrear = {
  id_local: string;
  persona_id: string;
  asignacion_id: string | null;
  items: Array<{ tipo: "HERRAMIENTA" | "INSUMO"; ref_id: string; cantidad: number }>;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaDespachoCerrar = {
  id_local: string;
  despacho_id: string;
  items: Array<{
    despacho_item_id: string;
    tipo: "HERRAMIENTA" | "INSUMO";
    devuelto?: boolean;
    consumido?: number;
  }>;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaCosecha = {
  id_local: string;
  persona_id: string;
  lote_id: string;
  metodo: "CANASTA" | "BASCULA";
  cantidad_canastas: number | null;
  capacidad_canasta_kg: number | null;
  peso_kg: number;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};

export type ItemColaSalida = {
  id_local: string;
  tipo: "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";
  cantidad_kg: number;
  cliente_detalle: string | null;
  precio_total: number | null;
  notas: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};
