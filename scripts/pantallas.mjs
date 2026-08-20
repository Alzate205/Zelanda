// Lista única de las pantallas fijas de la app, por rol.
//
// La comparten el barrido (que las mide) y las capturas (que las fotografía).
// Estaba duplicada y las dos copias se iban a separar: la que se olvidara de
// actualizar dejaría pantallas sin revisar sin que nadie se entere.

// Todas las pantallas fijas de la app, por rol. Antes esta lista tenía 19 de las
// ~100 rutas y dejaba afuera dos roles enteros: nadie había mirado nunca las
// pantallas de bodega ni las de almacén en tamaño celular.
// Las rutas con :id quedan afuera porque necesitan un registro concreto.
export const PANTALLAS_JEFE = [
  ['/jefe', 'jefe · inicio (mapa)'],
  ['/jefe/resumen', 'jefe · resumen'],
  ['/jefe/asignaciones', 'jefe · asignaciones'],
  ['/jefe/asignaciones/nueva', 'jefe · nueva asignación'],
  ['/jefe/tareas', 'jefe · tareas'],
  ['/jefe/tareas/nuevo', 'jefe · nueva tarea'],
  ['/jefe/lotes', 'jefe · lotes'],
  ['/jefe/lotes/nuevo', 'jefe · nuevo lote'],
  ['/jefe/equipo', 'jefe · equipo'],
  ['/jefe/equipo/nuevo', 'jefe · nuevo miembro'],
  ['/jefe/alertas', 'jefe · alertas'],
  ['/jefe/novedades', 'jefe · novedades'],
  ['/jefe/ausencias', 'jefe · ausencias'],
  ['/jefe/ausencias/nueva', 'jefe · nueva ausencia'],
  ['/jefe/pagos', 'jefe · pagos'],
  ['/jefe/pagos/nuevo', 'jefe · nuevo pago'],
  ['/jefe/jornales', 'jefe · jornales'],
  ['/jefe/jornales/nuevo', 'jefe · nuevo jornal'],
  ['/jefe/saldos', 'jefe · saldos'],
  ['/jefe/tarifas', 'jefe · tarifas'],
  ['/jefe/tarifas/nueva', 'jefe · nueva tarifa'],
  ['/jefe/compras', 'jefe · compras'],
  ['/jefe/compras/nueva', 'jefe · nueva compra'],
  ['/jefe/ventas', 'jefe · ventas'],
  ['/jefe/clientes', 'jefe · clientes'],
  ['/jefe/clientes/nuevo', 'jefe · nuevo cliente'],
  ['/jefe/proveedores', 'jefe · proveedores'],
  ['/jefe/proveedores/nuevo', 'jefe · nuevo proveedor'],
  ['/jefe/servicios', 'jefe · servicios'],
  ['/jefe/servicios/nuevo', 'jefe · nuevo servicio'],
  ['/jefe/inventario', 'jefe · inventario'],
  ['/jefe/movimientos', 'jefe · movimientos'],
  ['/jefe/almacen-vista', 'jefe · vista almacén'],
  ['/jefe/aplicaciones', 'jefe · aplicaciones'],
  ['/jefe/instalaciones', 'jefe · instalaciones'],
  ['/jefe/instalaciones/nueva', 'jefe · nueva instalación'],
  ['/jefe/instalaciones/finca', 'jefe · borde de finca'],
  ['/jefe/reportes', 'jefe · reportes'],
  ['/jefe/reportes/avanzados', 'jefe · reportes avanzados'],
  ['/jefe/informe-ia', 'jefe · informe IA'],
  ['/jefe/asistente', 'jefe · asistente'],
  ['/jefe/respaldo', 'jefe · respaldo'],
  ['/jefe/configuracion', 'jefe · configuración'],
  ['/recordatorios', 'jefe · recordatorios'],
  ['/recordatorios/nuevo', 'jefe · nuevo recordatorio'],
  ['/mi-perfil', 'jefe · mi perfil'],
];

export const PANTALLAS_TRABAJADOR = [
  ['/trabajador', 'trabajador · inicio'],
  ['/trabajador/pendientes', 'trabajador · pendientes'],
  ['/trabajador/tareas', 'trabajador · tareas'],
  ['/trabajador/prestamos', 'trabajador · préstamos'],
  ['/trabajador/novedad/nueva', 'trabajador · nueva novedad'],
  ['/mi-perfil', 'trabajador · mi perfil'],
];

export const PANTALLAS_BODEGA = [
  ['/bodega', 'bodega · inicio'],
  ['/bodega/pendientes', 'bodega · pendientes'],
  ['/bodega/despachos', 'bodega · despachos'],
  ['/bodega/despachos/nuevo', 'bodega · nuevo despacho'],
  ['/bodega/inventario', 'bodega · inventario'],
  ['/bodega/inventario/insumos/nuevo', 'bodega · nuevo insumo'],
  ['/bodega/inventario/herramientas/nueva', 'bodega · nueva herramienta'],
  ['/mi-perfil', 'bodega · mi perfil'],
];

export const PANTALLAS_ALMACEN = [
  ['/almacen', 'almacén · inicio'],
  ['/almacen/pendientes', 'almacén · pendientes'],
  ['/almacen/cosecha', 'almacén · cosecha'],
  ['/almacen/cosecha/nueva', 'almacén · nueva cosecha'],
  ['/almacen/salidas', 'almacén · salidas'],
  ['/almacen/salidas/nueva', 'almacén · nueva salida'],
  ['/mi-perfil', 'almacén · mi perfil'],
];
