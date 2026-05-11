import { requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Bodega" };

export default async function PaginaInicioBodega() {
  const usuario = await requerirUsuario("BODEGA");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenido, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Despachos del día
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Desde aquí despachará herramientas e insumos a los trabajadores y
          registrará las devoluciones. Funcionalidad disponible en la Fase 4.
        </p>
      </section>
    </div>
  );
}
