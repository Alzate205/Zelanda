"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import {
  crearRecordatorio,
  type EstadoRecordatorio,
} from "../acciones";

const ESTADO_INICIAL: EstadoRecordatorio = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Persona = { id: string; nombre_completo: string };

export function FormularioRecordatorio({
  esJefe,
  personaPropiaId,
  personaPropiaNombre,
  personas,
}: {
  esJefe: boolean;
  personaPropiaId: string | null;
  personaPropiaNombre: string;
  personas: Persona[];
}) {
  const [estado, accion, pendiente] = useActionState(
    crearRecordatorio,
    ESTADO_INICIAL,
  );
  const [paraOtro, setParaOtro] = useState(false);

  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const max = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <Link
        href="/recordatorios"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Recordatorios
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Crear
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo recordatorio
        </h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="titulo" className={labelBase}>
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            required
            maxLength={120}
            placeholder="Ej. Llamar al técnico del riego"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>
            Descripción (opcional)
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            placeholder="Notas adicionales…"
            className={`${inputBase} min-h-[80px] resize-y py-2.5`}
          />
        </div>

        <div>
          <label htmlFor="fecha" className={labelBase}>
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={hoyIso}
            min={hoyIso}
            max={max}
            className={inputBase}
          />
          <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
            El día indicado vas a recibir un push si tenés notificaciones activas.
          </p>
        </div>

        {esJefe && personas.length > 0 ? (
          <div>
            <label className={labelBase}>Asignado a</label>
            <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
              <button
                type="button"
                onClick={() => setParaOtro(false)}
                className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                  !paraOtro
                    ? "bg-white text-zelanda-verde-900 shadow-suave"
                    : "text-zelanda-verde-700"
                }`}
              >
                Para mí
              </button>
              <button
                type="button"
                onClick={() => setParaOtro(true)}
                className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                  paraOtro
                    ? "bg-white text-zelanda-verde-900 shadow-suave"
                    : "text-zelanda-verde-700"
                }`}
              >
                Para alguien del equipo
              </button>
            </div>
            {paraOtro ? (
              <select
                name="asignado_a_persona_id"
                required={paraOtro}
                className={`${inputBase} mt-2`}
                defaultValue=""
              >
                <option value="">Selecciona…</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_completo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="hidden"
                name="asignado_a_persona_id"
                value={personaPropiaId ?? ""}
              />
            )}
            {!paraOtro ? (
              <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
                Te lo vas a recordar a vos mismo ({personaPropiaNombre}).
              </p>
            ) : null}
          </div>
        ) : (
          <input
            type="hidden"
            name="asignado_a_persona_id"
            value={personaPropiaId ?? ""}
          />
        )}
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-estado-vencida/30 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <Link
            href="/recordatorios"
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendiente}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Check className="h-[18px] w-[18px]" />
            {pendiente ? "Creando…" : "Crear recordatorio"}
          </button>
        </div>
      </div>
    </form>
  );
}
