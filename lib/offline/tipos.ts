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
