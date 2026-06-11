import type { Metadata } from 'next';
import { FormularioLogin } from './formulario';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  const { redirigir } = await searchParams;

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{
        background:
          'radial-gradient(circle at 20% 0%, rgba(193,150,88,0.15), transparent 50%),' +
          'radial-gradient(circle at 80% 100%, rgba(58,92,68,0.20), transparent 55%),' +
          'linear-gradient(180deg, #faf7f2 0%, #f3e8d8 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-8 sm:pt-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div
              className="flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm shadow-lg shadow-zelanda-verde-900/10"
              style={{ width: 120, height: 120 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-zelanda.webp"
                alt="La Zelanda"
                style={{
                  height: '75%',
                  width: 'auto',
                }}
              />
            </div>
          </div>

          {/* Encabezado */}
          <div className="text-center mb-8">
            <p className="text-[9.5px] uppercase tracking-[0.20em] text-zelanda-verde-700/70 font-semibold">
              Hacienda
            </p>
            <h1 className="mt-1.5 font-serif text-5xl font-bold text-zelanda-verde-900">
              La Zelanda
            </h1>
            <p className="mt-2 text-sm text-zelanda-verde-700">Sistema de gestión integral</p>
          </div>

          {/* Formulario en card */}
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl shadow-zelanda-verde-900/8 p-8 border border-white">
            <FormularioLogin redirigir={redirigir} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-center py-6 px-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zelanda-verde-700/50 font-semibold">
          FincApp · v0.1
        </p>
      </div>
    </main>
  );
}
