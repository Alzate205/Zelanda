import { requerirUsuario } from '@/lib/auth';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { obtenerGeoFinca } from '@/lib/geo-finca';
import { CentroControlCargador } from '@/components/mapa3d/CentroControlCargador';

export const metadata = { title: 'Centro de control' };

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario('JEFE');
  const [snapshot, geo] = await Promise.all([construirSnapshotJefe(), obtenerGeoFinca()]);
  const nombrePila = usuario.nombre_completo.split(' ')[0];

  return <CentroControlCargador nombrePila={nombrePila} snapshotInicial={snapshot} geo={geo} />;
}
