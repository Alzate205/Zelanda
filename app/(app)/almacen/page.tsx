import { requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Almacén" };

export default async function PaginaInicioAlmacen() {
  const usuario = await requerirUsuario("ALMACEN");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenida, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Recepción de cosecha
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Aquí registrará el ingreso de aguacate por canastas o báscula, así
          como las salidas (ventas, consumo, pérdidas). Funcionalidad
          disponible en la Fase 4.
        </p>
      </section>
    </div>
  );
}
