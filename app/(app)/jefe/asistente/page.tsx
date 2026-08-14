import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { iaConfigurada } from '@/lib/ia/cliente';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ChatAsistente } from '@/components/jefe/ChatAsistente';

export const metadata = { title: 'Asistente' };

export default async function PaginaAsistente() {
  await requerirUsuario('JEFE');
  const activo = iaConfigurada();

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Centro de control
      </Link>

      <header>
        <Eyebrow>Jefe · Asistente</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Preguntale a la finca</h1>
      </header>

      {activo ? (
        <ChatAsistente />
      ) : (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zelanda-beige-100 text-zelanda-verde-700">
              <Sparkles className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="font-serif text-[15px] text-zelanda-verde-900">
                El asistente todavía no está activado
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-zelanda-verde-800">
                Está implementado pero apagado. Se cobra por pregunta, así que mientras no se active
                no genera ningún costo.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              Para encenderlo
            </p>
            <ol className="mt-2 space-y-1.5 text-[13px] text-zelanda-verde-800">
              <li>
                1. Correr <code className="font-mono text-[12px]">migracion-rol-ia.sql</code> en
                Supabase para crear el usuario de solo lectura.
              </li>
              <li>
                2. Cargar <code className="font-mono text-[12px]">DATABASE_URL_IA</code> con ese
                usuario y <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> en
                Vercel.
              </li>
              <li>3. Volver a desplegar.</li>
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
