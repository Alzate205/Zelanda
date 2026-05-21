"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { enviarDespachoCerrar } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const payload: Array<{
      despacho_item_id: string;
      tipo: "HERRAMIENTA" | "INSUMO";
      devuelto?: boolean;
      consumido?: number;
    }> = [];

    for (const it of items) {
      if (it.tipo === "HERRAMIENTA") {
        payload.push({
          despacho_item_id: it.id,
          tipo: "HERRAMIENTA",
          devuelto: formData.get(`devuelto_${it.id}`) === "on",
        });
      } else {
        const raw = String(formData.get(`consumido_${it.id}`) ?? "").trim();
        const consumido = Number(raw);
        const original = Number(it.cantidad);
        if (!Number.isFinite(consumido) || consumido < 0) {
          setError("Cantidad consumida inválida en un item.");
          return;
        }
        if (consumido > original) {
          setError("La cantidad consumida no puede ser mayor a la despachada.");
          return;
        }
        payload.push({
          despacho_item_id: it.id,
          tipo: "INSUMO",
          consumido,
        });
      }
    }

    startTransition(async () => {
      const r = await enviarDespachoCerrar({
        despacho_id: despachoId,
        items: payload,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/bodega/despachos");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — el cierre se guardará y subirá al volver la conexión.
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
        {pendiente ? "Cerrando..." : "Cerrar despacho"}
      </button>
    </form>
  );
}
