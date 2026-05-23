"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarApiario, type EstadoEdicionApiario } from "../acciones";

const ESTADO_INICIAL: EstadoEdicionApiario = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Apiario = {
  id: string;
  nombre: string;
  total_colmenas: number;
  ubicacion_descripcion: string | null;
  activo: boolean;
};

export function FormularioEditarApiario({ apiario }: { apiario: Apiario }) {
  const [estado, accion, pendiente] = useActionState(actualizarApiario, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="apiario_id" value={apiario.id} />

      <Link
        href={`/jefe/apiarios/${apiario.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {apiario.nombre}
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {apiario.nombre}
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información del apiario
        </h2>

        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={apiario.nombre}
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="total_colmenas" className={labelBase}>Total de colmenas</label>
          <input
            id="total_colmenas"
            name="total_colmenas"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={apiario.total_colmenas}
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="ubicacion_descripcion" className={labelBase}>Ubicación</label>
          <textarea
            id="ubicacion_descripcion"
            name="ubicacion_descripcion"
            rows={2}
            defaultValue={apiario.ubicacion_descripcion ?? ""}
            className={`${inputBase} min-h-[60px] resize-y`}
            placeholder="Ej. Sector norte de la finca, junto a la quebrada"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={apiario.activo}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700"
          />
          <span className="text-sm">
            <span className="font-medium text-zelanda-verde-900">Apiario activo</span>
            <span className="mt-0.5 block text-xs text-zelanda-verde-700">
              Si lo desactivas, dejará de aparecer en la lista pública del mapa.
            </span>
          </span>
        </label>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href={`/jefe/apiarios/${apiario.id}`}
          className="flex-1 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
