"use client";

import { useActionState, useState } from "react";
import { Sprout } from "lucide-react";
import {
  aplicarFechaSiembraArboles,
  type EstadoSiembra,
} from "../acciones";

const ESTADO_INICIAL: EstadoSiembra = { error: null, aviso: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormSiembra({
  loteId,
  fechaLote,
}: {
  loteId: string;
  fechaLote: string | null;
}) {
  const [estado, accion, pendiente] = useActionState(
    aplicarFechaSiembraArboles,
    ESTADO_INICIAL,
  );
  const [modo, setModo] = useState<"lote" | "lapso">("lote");

  return (
    <form
      action={accion}
      className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
    >
      <input type="hidden" name="lote_id" value={loteId} />
      <input type="hidden" name="modo" value={modo} />

      <div>
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Sprout className="h-4 w-4 text-zelanda-verde-600" />
          Aplicar fecha de siembra a árboles
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Definí cuándo se sembraron los árboles del lote. La edad en la ficha
          de cada árbol se calcula desde esta fecha.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo("lote")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            modo === "lote"
              ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
              : "border-zelanda-beige-300 text-zelanda-verde-700"
          }`}
        >
          Misma fecha
        </button>
        <button
          type="button"
          onClick={() => setModo("lapso")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            modo === "lapso"
              ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
              : "border-zelanda-beige-300 text-zelanda-verde-700"
          }`}
        >
          Lapso entre fechas
        </button>
      </div>

      {modo === "lote" ? (
        <p className="rounded-md bg-zelanda-beige-100 px-3 py-2 text-xs text-zelanda-verde-800">
          {fechaLote
            ? `Se usará la fecha de siembra del lote: ${fechaLote}.`
            : "Primero guardá una fecha de siembra del lote arriba."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="desde" className={labelBase}>
              Desde
            </label>
            <input
              id="desde"
              name="desde"
              type="date"
              required
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="hasta" className={labelBase}>
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              required
              className={inputBase}
            />
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-xs text-zelanda-verde-800">
        <input
          type="checkbox"
          name="sobrescribir"
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Sobrescribir árboles que ya tengan fecha. Si no marcás esto, solo se
          actualizan los árboles sin fecha.
        </span>
      </label>

      {estado.aviso ? (
        <p
          role="status"
          className="rounded-md border border-zelanda-verde-300 bg-zelanda-verde-50 px-3 py-2 text-sm text-zelanda-verde-800"
        >
          {estado.aviso}
        </p>
      ) : null}

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || (modo === "lote" && !fechaLote)}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-base font-medium text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60"
      >
        {pendiente ? "Aplicando..." : "Aplicar a árboles"}
      </button>
    </form>
  );
}
