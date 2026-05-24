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
    <main
      className="flex min-h-svh flex-col"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(193,150,88,0.20), transparent 50%)," +
          "radial-gradient(circle at 80% 100%, rgba(58,92,68,0.25), transparent 55%)," +
          "linear-gradient(180deg, #fbf7f0 0%, #f5ede0 100%)",
      }}
    >
      <div className="pt-12 text-center">
        <div
          className="mx-auto flex items-center justify-center"
          style={{ width: 160, height: 160 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="La Zelanda"
            style={{
              height: "100%",
              width: "auto",
              filter: "drop-shadow(0 8px 18px rgba(20,44,26,0.18))",
            }}
          />
        </div>
        <p className="mt-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Hacienda
        </p>
        <h1 className="mt-1 font-serif text-4xl text-zelanda-verde-900">
          La Zelanda
        </h1>
        <p className="text-sm text-zelanda-verde-700">
          Sistema integral de finca · Quindío
        </p>
      </div>

      <div className="mx-auto mt-9 w-full max-w-sm px-6">
        <FormularioLogin redirigir={redirigir} />
      </div>

      <p className="mt-auto pb-7 text-center text-[10.5px] uppercase tracking-[0.16em] text-zelanda-verde-700/55">
        FincApp · v0.1
      </p>
    </main>
  );
}
