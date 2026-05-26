import 'server-only';

import { revalidateTag } from 'next/cache';

export function revalidarSnapshotJefe() {
  revalidateTag('snapshot-jefe');
}

export function revalidarSnapshotTrabajador() {
  revalidateTag('snapshot-trabajador');
}

export function revalidarSnapshotBodega() {
  revalidateTag('snapshot-bodega');
}

export function revalidarDashboards() {
  revalidarSnapshotJefe();
  revalidarSnapshotTrabajador();
  revalidarSnapshotBodega();
}
