"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarTipoTarea, type EstadoTipoTarea } from "../../acciones";

const ESTADO_INICIAL: EstadoTipoTarea = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Tipo = {
  id: string;
  nombre: string;
  descripcion: string;
  frecuencia_dias_default: number;
  area: "CULTIVO" | "APICULTURA";
  color: string;
  icono: string;
};

export function FormularioEditarTipo({ tipo }: { tipo: Tipo }) {
  const [estado, accion, pendiente] = useActionState(actualizarTipoTarea, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="tipo_id" value={tipo.id} />

      <Link
        href="/jefe/tareas"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Tipos de tarea
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {tipo.nombre}
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={tipo.nombre}
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            defaultValue={tipo.descripcion}
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="frecuencia_dias_default" className={labelBase}>
              Frecuencia (días)
            </label>
            <input
              id="frecuencia_dias_default"
              name="frecuencia_dias_default"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={tipo.frecuencia_dias_default}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="area_visible" className={labelBase}>Área</label>
            <input
              id="area_visible"
              type="text"
              value={tipo.area === "CULTIVO" ? "Cultivo" : "Apicultura"}
              disabled
              className={`${inputBase} cursor-not-allowed opacity-60`}
            />
            <p className="mt-1 text-xs text-zelanda-verde-700">
              El área no se puede modificar una vez creado el tipo (preserva el historial).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="color" className={labelBase}>Color (hex, opcional)</label>
            <input
              id="color"
              name="color"
              type="text"
              placeholder="#7e3a17"
              defaultValue={tipo.color}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="icono" className={labelBase}>Ícono lucide (opcional)</label>
            <input
              id="icono"
              name="icono"
              type="text"
              placeholder="droplet"
              defaultValue={tipo.icono}
              className={inputBase}
            />
          </div>
        </div>
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
          href="/jefe/tareas"
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
