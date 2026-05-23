"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearAsignacion, type EstadoAsignacion } from "../acciones";

const ESTADO_INICIAL: EstadoAsignacion = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Opcion = { id: string; nombre: string };
type TipoOpcion = Opcion & { area: "CULTIVO" | "APICULTURA" };

export function FormularioNuevaAsignacion({
  lotes,
  apiarios,
  tipos,
  personas,
  preselect,
}: {
  lotes: Opcion[];
  apiarios: Opcion[];
  tipos: TipoOpcion[];
  personas: { id: string; nombre_completo: string }[];
  preselect: { lote_id: string | null; apiario_id: string | null; tipo_tarea_id: string | null };
}) {
  const [estado, accion, pendiente] = useActionState(crearAsignacion, ESTADO_INICIAL);
  const [destino, setDestino] = useState<"lote" | "apiario">(
    preselect.apiario_id ? "apiario" : "lote",
  );

  const tiposFiltrados = tipos.filter((t) =>
    destino === "lote" ? t.area === "CULTIVO" : t.area === "APICULTURA",
  );

  const hoy = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/asignaciones"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Asignaciones
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Crear
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva asignación
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label className={labelBase}>Destino</label>
          <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <label
              className={`flex cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                destino === "lote"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700 hover:text-zelanda-verde-900"
              }`}
            >
              <input
                type="radio"
                name="destino"
                value="lote"
                checked={destino === "lote"}
                onChange={() => setDestino("lote")}
                className="sr-only"
              />
              Lote
            </label>
            <label
              className={`flex cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                destino === "apiario"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700 hover:text-zelanda-verde-900"
              }`}
            >
              <input
                type="radio"
                name="destino"
                value="apiario"
                checked={destino === "apiario"}
                onChange={() => setDestino("apiario")}
                className="sr-only"
              />
              Apiario
            </label>
          </div>
        </div>

        {destino === "lote" ? (
          <div>
            <label htmlFor="lote_id" className={labelBase}>Lote</label>
            <select
              id="lote_id"
              name="lote_id"
              required
              defaultValue={preselect.lote_id ?? ""}
              className={inputBase}
            >
              <option value="">Selecciona…</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="apiario_id" className={labelBase}>Apiario</label>
            <select
              id="apiario_id"
              name="apiario_id"
              required
              defaultValue={preselect.apiario_id ?? ""}
              className={inputBase}
            >
              <option value="">Selecciona…</option>
              {apiarios.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="tipo_tarea_id" className={labelBase}>Tipo de tarea</label>
          <select
            id="tipo_tarea_id"
            name="tipo_tarea_id"
            required
            defaultValue={preselect.tipo_tarea_id ?? ""}
            className={inputBase}
          >
            <option value="">Selecciona…</option>
            {tiposFiltrados.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="persona_id" className={labelBase}>Persona</label>
          <select id="persona_id" name="persona_id" required className={inputBase}>
            <option value="">Selecciona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fecha_inicio" className={labelBase}>Fecha de inicio</label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            defaultValue={hoy}
            max={max}
            className={inputBase}
          />
        </div>
      </section>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Link
          href="/jefe/asignaciones"
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex min-h-touch flex-[1.4] items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          {pendiente ? "Creando…" : "Crear asignación"}
        </button>
      </div>
    </form>
  );
}
