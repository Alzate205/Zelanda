"use client";

import { useActionState, useState } from "react";
import { crearCosecha, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioCosecha({
  personas,
  lotes,
}: {
  personas: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
}) {
  const [estado, formAction, pending] = useActionState(
    crearCosecha,
    ESTADO_INICIAL,
  );
  const [metodo, setMetodo] = useState<"CANASTA" | "BASCULA">("CANASTA");
  const [canastas, setCanastas] = useState("");
  const [capacidad, setCapacidad] = useState("");

  const pesoCalculado =
    metodo === "CANASTA" && canastas && capacidad
      ? Number(canastas) * Number(capacidad)
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Recolector
        </label>
        <select
          name="persona_id"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Lote
        </label>
        <select
          name="lote_id"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">
          Método de medición
        </p>
        <div className="mt-1 flex gap-2">
          {(["CANASTA", "BASCULA"] as const).map((m) => (
            <label
              key={m}
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                metodo === m
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300"
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={m}
                checked={metodo === m}
                onChange={() => setMetodo(m)}
                className="sr-only"
              />
              {m === "CANASTA" ? "Canasta" : "Báscula"}
            </label>
          ))}
        </div>
      </div>

      {metodo === "CANASTA" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Cantidad de canastas
            </label>
            <input
              name="cantidad_canastas"
              type="number"
              min="1"
              step="1"
              required
              value={canastas}
              onChange={(e) => setCanastas(e.target.value)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Capacidad por canasta (kg)
            </label>
            <input
              name="capacidad_canasta_kg"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          {pesoCalculado !== null && (
            <p className="rounded-lg bg-zelanda-beige-100 px-3 py-2 text-sm text-zelanda-verde-900">
              Peso calculado: <strong>{pesoCalculado.toFixed(2)} kg</strong>
            </p>
          )}
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Peso (kg)
          </label>
          <input
            name="peso_kg"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar cosecha"}
      </button>
    </form>
  );
}
