import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  const { redirigir } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-zelanda-verde-700">
            Hacienda
          </p>
          <h1 className="mt-2 font-serif text-4xl text-zelanda-verde-900">
            La Zelanda
          </h1>
          <p className="mt-3 text-sm text-zelanda-verde-700">
            Sistema interno de gestión de finca
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-6 shadow-card">
          <FormularioLogin redirigir={redirigir} />
        </div>
      </div>
    </main>
  );
}
