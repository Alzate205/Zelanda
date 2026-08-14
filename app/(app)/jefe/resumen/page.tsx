import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { construirSnapshotJefe } from '@/lib/jefe/snapshot';
import { obtenerClimaFinca, type ClimaFinca } from '@/lib/jefe/clima';
import { diagnosticar } from '@/lib/diagnostico';
import { faseDelMes } from '@/lib/fenologia';
import { hoyEnBogota } from '@/lib/fecha';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { BotonImprimir } from '@/components/ui/BotonImprimir';
import { PanelDiagnostico } from '@/components/jefe/PanelDiagnostico';
import { ResumenEjecutivo } from '@/components/jefe/ResumenEjecutivo';
import { ResumenClima } from '@/components/jefe/ResumenClima';
import { CalendarioFenologico } from '@/components/jefe/CalendarioFenologico';

export const metadata = { title: 'Resumen de la finca' };

/** El clima es de un tercero: si falla, la pantalla sigue sirviendo sin él. */
async function climaOpcional(): Promise<ClimaFinca | null> {
  try {
    return await obtenerClimaFinca();
  } catch {
    return null;
  }
}

export default async function PaginaResumenJefe() {
  await requerirUsuario('JEFE');

  const [snapshot, clima] = await Promise.all([construirSnapshotJefe(), climaOpcional()]);

  const hoy = hoyEnBogota();
  const alertas = diagnosticar(snapshot, clima, hoy);
  const fenologia = faseDelMes(hoy);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="no-print -ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Centro de control
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Jefe · Resumen</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Estado de la finca</h1>
        </div>
        <BotonImprimir etiqueta="Imprimir" />
      </header>

      <Link
        href="/jefe/informe-ia"
        className="no-print flex items-center gap-3 rounded-2xl border border-zelanda-verde-300 bg-zelanda-verde-50 px-4 py-3.5 shadow-suave transition hover:border-zelanda-verde-400"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zelanda-verde-700 text-zelanda-beige-50">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[15px] text-zelanda-verde-900">
            Preguntarle a la IA
          </span>
          <span className="block text-[12.5px] text-zelanda-verde-700">
            Copia el estado de la finca y pégalo en tu chat de Claude
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/50" />
      </Link>

      <PanelDiagnostico alertas={alertas} />
      <ResumenEjecutivo snapshot={snapshot} />
      {clima ? <ResumenClima clima={clima} /> : null}
      <CalendarioFenologico fenologia={fenologia} />
    </div>
  );
}
