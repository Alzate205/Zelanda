import { requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Jefe" };

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario("JEFE");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Panel del jefe
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenido, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Fase 1 en curso
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Estás viendo la infraestructura base del sistema. Aquí irán la visión
          general de la finca, alertas, métricas, asignación de tareas y
          consulta de fichas de árboles.
        </p>
      </section>
    </div>
  );
}
