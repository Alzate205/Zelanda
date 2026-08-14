import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { recolectarDatosFinca } from '@/lib/ia/recolectar-informe';
import { redactarInforme } from '@/lib/ia/informe-finca';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { BotonCopiarInforme } from '@/components/jefe/BotonCopiarInforme';

export const metadata = { title: 'Preguntarle a la IA' };

export default async function PaginaInformeIA() {
  await requerirUsuario('JEFE');

  const datos = await recolectarDatosFinca();
  const informe = redactarInforme(datos);
  const miles = Math.round(informe.length / 1000);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/resumen"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Resumen
      </Link>

      <header>
        <Eyebrow>Jefe · Informe</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Preguntarle a la IA</h1>
        <p className="mt-1.5 text-sm text-zelanda-verde-700">
          Copia este informe y pégalo en tu conversación de Claude. Trae el estado completo de la
          finca, así puedes preguntar lo que quieras sin tener que explicarle nada.
        </p>
      </header>

      <ol className="space-y-1.5 rounded-2xl border border-zelanda-beige-200 bg-white p-4 text-sm text-zelanda-verde-800 shadow-suave">
        <li>1. Toca “Copiar informe”.</li>
        <li>2. Abre tu proyecto de Claude y pega.</li>
        <li>3. Pregunta lo que necesites sobre la finca.</li>
      </ol>

      <BotonCopiarInforme texto={informe} />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-base text-zelanda-verde-900">Lo que se va a copiar</h2>
          <span className="text-xs text-zelanda-verde-700">~{miles} mil caracteres</span>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-zelanda-beige-200 bg-white p-4 text-[12.5px] leading-relaxed text-zelanda-verde-900 shadow-suave">
          {informe}
        </pre>
      </section>
    </div>
  );
}
