"use client";

import { useActionState } from "react";
import { cerrarDespacho, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

type ItemRow = {
  id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  nombre: string;
  unidad: string;
  cantidad: string;
};

export function FormularioCierreDespacho({
  despachoId,
  items,
}: {
  despachoId: string;
  items: ItemRow[];
}) {
  const [estado, formAction, pending] = useActionState(
    cerrarDespacho,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="despacho_id" value={despachoId} />

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h3 className="font-serif text-lg text-zelanda-verde-900">Devoluciones</h3>
        <ul className="mt-3 space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-zelanda-beige-200 p-3"
            >
              <p className="text-sm font-medium text-zelanda-verde-900">
                {it.nombre}
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                Despachado: {it.cantidad}{" "}
                {it.tipo === "INSUMO" ? it.unidad : "unidades"}
              </p>
              {it.tipo === "HERRAMIENTA" ? (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`devuelto_${it.id}`}
                    defaultChecked
                    className="h-5 w-5"
                  />
                  Devuelta
                </label>
              ) : (
                <div className="mt-2">
                  <label className="block text-xs text-zelanda-verde-700">
                    Cantidad consumida ({it.unidad})
                  </label>
                  <input
                    type="number"
                    name={`consumido_${it.id}`}
                    min="0"
                    max={it.cantidad}
                    step="0.001"
                    defaultValue={it.cantidad}
                    required
                    className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

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
        {pending ? "Cerrando..." : "Cerrar despacho"}
      </button>
    </form>
  );
}
