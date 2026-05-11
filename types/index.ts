export type RolUsuario = "JEFE" | "BODEGA" | "ALMACEN" | "TRABAJADOR";

export type EstadoArbol = "SALUDABLE" | "CON_NOVEDAD" | "MUERTO" | "REMOVIDO";

export type AreaTarea = "CULTIVO" | "APICULTURA";

export type EstadoAsignacion =
  | "PENDIENTE"
  | "EN_CURSO"
  | "COMPLETADA"
  | "CANCELADA";

export type TipoRegistro = "TRAMO" | "SUELTOS";

export type TipoNovedad =
  | "PLAGA"
  | "DANO_FISICO"
  | "ENFERMEDAD"
  | "OBSERVACION"
  | "OTRO";

export type CategoriaItem = "CULTIVO" | "COSECHA" | "APICULTURA";

export type EstadoDespacho = "ABIERTO" | "CERRADO";

export type TipoItem = "HERRAMIENTA" | "INSUMO";

export type MetodoMedicion = "CANASTA" | "BASCULA";

export type TipoSalida = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

export type TipoMovimiento =
  | "RESERVA"
  | "CONSUMO"
  | "DEVOLUCION"
  | "AJUSTE"
  | "INGRESO";

export type RespuestaApi<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
