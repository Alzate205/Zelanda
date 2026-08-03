import { requerirUsuario } from '@/lib/auth';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { WidgetClima } from '@/components/jefe/WidgetClima';
import { CalendarioFenologico } from '@/components/jefe/CalendarioFenologico';
import { ResumenEjecutivo } from '@/components/jefe/ResumenEjecutivo';
import DiagnosticoIA from '@/components/DiagnosticoIA';

export const metadata = { title: 'Dashboard - La Zelanda' };

export default async function DashboardPage() {
  const usuario = await requerirUsuario('JEFE');
  const snapshot = await construirSnapshotJefe();

  return (
    <div className="mx-auto max-w-screen-md space-y-4 p-4 pb-24">
      <header className="mb-4">
        <h1 className="font-serif text-2xl text-zelanda-verde-900">
          Buen día, {usuario.nombre_completo.split(' ')[0]}
        </h1>
        <p className="text-sm text-zelanda-verde-700">
          Diagnóstico y resumen general de la finca
        </p>
      </header>

      <DiagnosticoIA />
      <ResumenEjecutivo snapshot={snapshot} />
      <WidgetClima />
      <CalendarioFenologico />
    </div>
  );
}
