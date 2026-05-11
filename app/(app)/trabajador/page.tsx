import { requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Mis tareas" };

export default async function PaginaInicioTrabajador() {
  const usuario = await requerirUsuario("TRABAJADOR");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Trabajador
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Tus tareas
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Aquí verás las tareas que el jefe te asigne y podrás registrar tu
          avance (tramo, sueltos o novedades). Funcionalidad disponible en la
          Fase 3.
        </p>
      </section>
    </div>
  );
}
