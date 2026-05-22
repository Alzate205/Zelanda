"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { enviarCosecha } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function FormularioCosecha({
  personas,
  lotes,
}: {
  personas: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [metodo, setMetodo] = useState<"CANASTA" | "BASCULA">("CANASTA");
  const [canastas, setCanastas] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [peso, setPeso] = useState("");
  const [notas, setNotas] = useState("");

  const pesoCalculado =
    metodo === "CANASTA" && canastas && capacidad
      ? Number(canastas) * Number(capacidad)
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!personaId) {
      setError("Selecciona un recolector.");
      return;
    }
    if (!loteId) {
      setError("Selecciona un lote.");
      return;
    }

    let pesoKg: number;
    let cantidadCanastas: number | null = null;
    let capacidadCanastaKg: number | null = null;

    if (metodo === "CANASTA") {
      const c = Number(canastas);
      const cap = Number(capacidad);
      if (!Number.isInteger(c) || c <= 0) {
        setError("Cantidad de canastas debe ser entero positivo.");
        return;
      }
      if (!Number.isFinite(cap) || cap <= 0) {
        setError("Capacidad de canasta debe ser positiva.");
        return;
      }
      cantidadCanastas = c;
      capacidadCanastaKg = cap;
      pesoKg = c * cap;
    } else {
      const p = Number(peso);
      if (!Number.isFinite(p) || p <= 0) {
        setError("Peso debe ser positivo.");
        return;
      }
      pesoKg = p;
    }

    startTransition(async () => {
      const r = await enviarCosecha({
        persona_id: personaId,
        lote_id: loteId,
        metodo,
        cantidad_canastas: cantidadCanastas,
        capacidad_canasta_kg: capacidadCanastaKg,
        peso_kg: pesoKg,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/almacen/cosecha");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="recolector" className="block text-sm font-medium text-zelanda-verde-900">
          Recolector
        </label>
        <select
          id="recolector"
          required
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
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
        <label htmlFor="lote" className="block text-sm font-medium text-zelanda-verde-900">
          Lote
        </label>
        <select
          id="lote"
          required
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
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
            <label htmlFor="canastas" className="block text-sm font-medium text-zelanda-verde-900">
              Cantidad de canastas
            </label>
            <input
              id="canastas"
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
            <label htmlFor="capacidad" className="block text-sm font-medium text-zelanda-verde-900">
              Capacidad por canasta (kg)
            </label>
            <input
              id="capacidad"
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
          <label htmlFor="peso" className="block text-sm font-medium text-zelanda-verde-900">
            Peso (kg)
          </label>
          <input
            id="peso"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label htmlFor="notas" className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          id="notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la cosecha se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pendiente ? "Registrando..." : "Registrar cosecha"}
      </button>
    </form>
  );
}
