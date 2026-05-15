"use client";

import { useActionState, useState } from "react";
import { crearSalida, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

type Tipo = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

export function FormularioSalida({ stockMax }: { stockMax: number }) {
  const [estado, formAction, pending] = useActionState(
    crearSalida,
    ESTADO_INICIAL,
  );
  const [tipo, setTipo] = useState<Tipo>("VENTA");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">Tipo</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["VENTA", "CONSUMO", "PERDIDA", "OTRO"] as const).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                tipo === t
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="sr-only"
              />
              {t === "VENTA"
                ? "Venta"
                : t === "CONSUMO"
                  ? "Consumo"
                  : t === "PERDIDA"
                    ? "Pérdida"
                    : "Otro"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad (kg)
        </label>
        <input
          name="cantidad_kg"
          type="number"
          min="0.01"
          max={stockMax}
          step="0.01"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {tipo === "VENTA" && (
        <>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Cliente
            </label>
            <input
              name="cliente_detalle"
              required
              placeholder="Nombre exportador / comprador"
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Precio total (COP, opcional)
            </label>
            <input
              name="precio_total"
              type="number"
              min="1"
              step="1"
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
        </>
      )}

      {tipo !== "VENTA" && (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Detalle (opcional)
          </label>
          <input
            name="cliente_detalle"
            placeholder="ej: consumo casa principal"
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
        {pending ? "Registrando..." : "Registrar salida"}
      </button>
    </form>
  );
}
