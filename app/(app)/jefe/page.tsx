import { requerirUsuario } from '@/lib/auth';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { DashboardJefeCliente } from './_dashboard-cliente';

export const metadata = { title: 'Panel del jefe' };

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario('JEFE');
  const snapshot = await construirSnapshotJefe();
  const nombrePila = usuario.nombre_completo.split(' ')[0];

  return <DashboardJefeCliente nombrePila={nombrePila} snapshotInicial={snapshot} />;
}
