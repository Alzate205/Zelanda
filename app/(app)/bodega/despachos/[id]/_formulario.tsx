"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Wrench } from "lucide-react";
import { enviarDespachoCerrar } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type ItemRow = {
  id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  nombre: string;
  unidad: string;
  cantidad: string;
};

type EstadoHerramienta = {
  danada: boolean;
  sucia: boolean;
  notas: string;
};

function construirCondicion(e: EstadoHerramienta): string | null {
  const partes: string[] = [];
  if (e.danada) partes.push("dañada");
  if (e.sucia) partes.push("sucia");
  const notas = e.notas.trim();
  if (notas) partes.push(notas);
  return partes.length > 0 ? partes.join(" · ") : null;
}

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
  const [estadosHerr, setEstadosHerr] = useState<Record<string, EstadoHerramienta>>(
    () => {
      const o: Record<string, EstadoHerramienta> = {};
      for (const it of items) {
        if (it.tipo === "HERRAMIENTA") {
          o[it.id] = { danada: false, sucia: false, notas: "" };
        }
      }
      return o;
    },
  );

  function actualizarEstadoHerr(id: string, patch: Partial<EstadoHerramienta>) {
    setEstadosHerr((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const payload: Array<{
      despacho_item_id: string;
      tipo: "HERRAMIENTA" | "INSUMO";
      devuelto?: boolean;
      consumido?: number;
      condicion_devolucion?: string | null;
    }> = [];

    for (const it of items) {
      if (it.tipo === "HERRAMIENTA") {
        payload.push({
          despacho_item_id: it.id,
          tipo: "HERRAMIENTA",
          devuelto: true,
          condicion_devolucion: construirCondicion(estadosHerr[it.id]),
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
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h3 className="font-serif text-lg text-zelanda-verde-900">Devoluciones</h3>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Al cerrar el despacho, todas las herramientas quedan registradas como
          devueltas. Marcá si alguna llegó dañada o sucia.
        </p>
        <ul className="mt-4 space-y-3">
          {items.map((it) => {
            if (it.tipo === "HERRAMIENTA") {
              const e = estadosHerr[it.id];
              return (
                <li
                  key={it.id}
                  className="rounded-lg border border-zelanda-beige-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 shrink-0 text-zelanda-verde-700" />
                    <p className="text-sm font-medium text-zelanda-verde-900">
                      {it.nombre}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-zelanda-verde-700/70">
                    {it.cantidad} {Number(it.cantidad) === 1 ? "unidad" : "unidades"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                        e?.danada
                          ? "border-estado-vencida bg-estado-vencida/10 text-estado-vencida"
                          : "border-zelanda-beige-300 text-zelanda-verde-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={e?.danada ?? false}
                        onChange={(ev) =>
                          actualizarEstadoHerr(it.id, { danada: ev.target.checked })
                        }
                        className="sr-only"
                      />
                      Dañada
                    </label>
                    <label
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                        e?.sucia
                          ? "border-zelanda-ocre-500 bg-zelanda-ocre-50 text-zelanda-ocre-700"
                          : "border-zelanda-beige-300 text-zelanda-verde-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={e?.sucia ?? false}
                        onChange={(ev) =>
                          actualizarEstadoHerr(it.id, { sucia: ev.target.checked })
                        }
                        className="sr-only"
                      />
                      Sucia
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Otras observaciones (opcional)"
                    value={e?.notas ?? ""}
                    onChange={(ev) =>
                      actualizarEstadoHerr(it.id, { notas: ev.target.value })
                    }
                    className="mt-2 block w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2 text-sm"
                  />
                </li>
              );
            }
            return (
              <li
                key={it.id}
                className="rounded-lg border border-zelanda-beige-200 p-3"
              >
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {it.nombre}
                </p>
                <p className="text-xs text-zelanda-verde-700/70">
                  Despachado: {it.cantidad} {it.unidad}
                </p>
                <div className="mt-2">
                  <label className="block text-xs text-zelanda-verde-700">
                    Cantidad consumida ({it.unidad})
                  </label>
                  <input
                    type="number"
                    name={`consumido_${it.id}`}
                    inputMode="decimal"
                    min="0"
                    max={it.cantidad}
                    step="0.001"
                    defaultValue={it.cantidad}
                    required
                    className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
                  />
                </div>
              </li>
            );
          })}
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
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pendiente ? "Cerrando..." : "Cerrar despacho"}
      </button>
    </form>
  );
}
