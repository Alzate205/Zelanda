"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { crearJornal, type EstadoJornal } from "../acciones";
import { formatearMiles, normalizarEntradaNumerica } from "@/lib/formatos";

const ESTADO_INICIAL: EstadoJornal = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Persona = {
  id: string;
  nombre: string;
  tipo: "FIJO" | "JORNALERO" | "CONTRATISTA" | "FAMILIAR" | null;
  tarifa_jornal: number | null;
};
type Lote = { id: string; nombre: string };

const ETIQUETA_TIPO: Record<string, string> = {
  FIJO: "Fijo",
  JORNALERO: "Jornalero",
  CONTRATISTA: "Contratista",
  FAMILIAR: "Familia",
};

export function FormularioJornal({
  personas,
  lotes,
}: {
  personas: Persona[];
  lotes: Lote[];
}) {
  const [estado, accion, pendiente] = useActionState(crearJornal, ESTADO_INICIAL);
  const [personaId, setPersonaId] = useState("");
  const [tarifa, setTarifa] = useState("");

  const hoy = new Date().toISOString().slice(0, 10);
  const personaElegida = personas.find((p) => p.id === personaId);

  // Auto-sugerir tarifa cuando se elige una persona con tarifa_jornal
  useEffect(() => {
    if (personaElegida?.tarifa_jornal != null) {
      setTarifa(String(Math.round(personaElegida.tarifa_jornal)));
    } else {
      setTarifa("");
    }
  }, [personaId, personaElegida]);

  // Jornaleros activos primero, luego el resto
  const jornaleros = personas.filter((p) => p.tipo === "JORNALERO");
  const otros = personas.filter((p) => p.tipo !== "JORNALERO");

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <Link
        href="/jefe/jornales"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Jornales
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Registrar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo jornal
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Día trabajado. La tarifa queda congelada con el valor que pongas
          ahora, aunque cambie después.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="persona_id" className={labelBase}>
            ¿Quién trabajó?
          </label>
          <select
            id="persona_id"
            name="persona_id"
            required
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className={inputBase}
          >
            <option value="">Selecciona persona…</option>
            {jornaleros.length > 0 ? (
              <optgroup label="Jornaleros">
                {jornaleros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {otros.length > 0 ? (
              <optgroup label="Otros">
                {otros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.tipo ? ` (${ETIQUETA_TIPO[p.tipo]})` : ""}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {personaElegida ? (
            <p className="mt-1 text-[11px] text-zelanda-verde-700/80">
              {personaElegida.tipo
                ? `Vinculación actual: ${ETIQUETA_TIPO[personaElegida.tipo]}`
                : "Sin vinculación activa"}
              {personaElegida.tarifa_jornal != null
                ? ` · Tarifa default: ${personaElegida.tarifa_jornal.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tarifa_aplicada" className={labelBase}>
              Tarifa (COP)
            </label>
            <input
              id="tarifa_aplicada"
              name="tarifa_aplicada"
              type="text"
              inputMode="numeric"
              required
              placeholder="50.000"
              value={formatearMiles(tarifa)}
              onChange={(e) =>
                setTarifa(normalizarEntradaNumerica(e.target.value))
              }
              className={inputBase}
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
              defaultValue={hoy}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor="lote_id" className={labelBase}>
            Lote (opcional)
          </label>
          <select
            id="lote_id"
            name="lote_id"
            className={inputBase}
            defaultValue=""
          >
            <option value="">Sin lote específico</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="descripcion_actividad" className={labelBase}>
            Actividad (opcional)
          </label>
          <input
            id="descripcion_actividad"
            name="descripcion_actividad"
            type="text"
            placeholder="Ej: Plateo, recolección, riego, cerca"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            placeholder="Observaciones, condiciones especiales, etc."
            className={`${inputBase} min-h-[60px] resize-y py-2.5`}
          />
        </div>
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
            href="/jefe/jornales"
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
            {pendiente ? "Registrando…" : "Registrar jornal"}
          </button>
        </div>
      </div>
    </form>
  );
}
