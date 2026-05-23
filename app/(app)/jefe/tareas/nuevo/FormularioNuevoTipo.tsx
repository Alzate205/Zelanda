"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearTipoTarea, type EstadoTipoTarea } from "../acciones";

const ESTADO_INICIAL: EstadoTipoTarea = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

export function FormularioNuevoTipo() {
  const [estado, accion, pendiente] = useActionState(crearTipoTarea, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/tareas"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Tipos de tarea
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Crear
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo tipo de tarea
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input id="nombre" name="nombre" type="text" required className={inputBase} />
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
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
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="area" className={labelBase}>Área</label>
            <select id="area" name="area" required defaultValue="CULTIVO" className={inputBase}>
              <option value="CULTIVO">Cultivo</option>
              <option value="APICULTURA">Apicultura</option>
            </select>
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
          {pendiente ? "Creando…" : "Crear"}
        </button>
      </div>
    </form>
  );
}
