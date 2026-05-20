import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { FormularioNuevaInstalacion } from "./_formulario";

export const metadata = { title: "Nueva instalación" };

export default async function Page() {
  await requerirUsuario("JEFE");
  return (
    <div className="space-y-6">
      <Link
        href="/jefe/instalaciones"
        className="inline-flex items-center gap-1 text-sm text-zelanda-verde-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Mapa
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva instalación
        </h1>
      </header>
      <FormularioNuevaInstalacion />
    </div>
  );
}
