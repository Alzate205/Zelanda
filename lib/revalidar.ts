import 'server-only';

import { revalidateTag } from 'next/cache';

/** Revalida el snapshot del dashboard del jefe. */
export function revalidarSnapshotJefe() {
  revalidateTag('snapshot-jefe');
}

/** Revalida el snapshot del dashboard del trabajador. */
export function revalidarSnapshotTrabajador() {
  revalidateTag('snapshot-trabajador');
}

/** Revalida el snapshot del dashboard de bodega. */
export function revalidarSnapshotBodega() {
  revalidateTag('snapshot-bodega');
}

/** Revalida el snapshot del dashboard de almacén. */
export function revalidarSnapshotAlmacen() {
  revalidateTag('snapshot-almacen');
}

/** Revalida todos los dashboards (jefe, trabajador, bodega). */
export function revalidarDashboards() {
  revalidarSnapshotJefe();
  revalidarSnapshotTrabajador();
  revalidarSnapshotBodega();
}

/** Revalida despachos de bodega y afecta alertas del jefe por cambio de stock. */
export function revalidarDespachos() {
  revalidarSnapshotBodega();
  revalidarDashboards();
}

/** Revalida todos los snapshots: dashboards + almacén. */
export function revalidarTodos() {
  revalidarDashboards();
  revalidarSnapshotAlmacen();
}
