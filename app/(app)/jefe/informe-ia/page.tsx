import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { recolectarDatosFinca } from '@/lib/ia/recolectar-informe';
import { partesInforme } from '@/lib/ia/informe-finca';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ArmadorInforme } from '@/components/jefe/ArmadorInforme';

export const metadata = { title: 'Preguntarle a la IA' };

// Sin caché: el botón de actualizar tiene que traer la finca como está ahora,
// no una versión guardada de hace un rato.
export const dynamic = 'force-dynamic';

export default async function PaginaInformeIA() {
  await requerirUsuario('JEFE');

  const datos = await recolectarDatosFinca();
  const partes = partesInforme(datos);
  const generadoEn = new Date().toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });

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
          Elegí qué llevar, copialo y pegalo en tu conversación de Claude. Va el estado de la finca,
          así podés preguntar lo que quieras sin explicarle nada.
        </p>
      </header>

      <ol className="space-y-1.5 rounded-2xl border border-zelanda-beige-200 bg-white p-4 text-sm text-zelanda-verde-800 shadow-suave">
        <li>1. Marcá lo que quieras incluir.</li>
        <li>2. Tocá “Copiar informe”.</li>
        <li>3. Abrí tu proyecto de Claude, pegá y preguntá.</li>
      </ol>

      <ArmadorInforme partes={partes} generadoEn={generadoEn} />
    </div>
  );
}
