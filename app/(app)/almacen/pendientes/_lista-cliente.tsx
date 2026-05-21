"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { listarTodos, borrarItem, reintentar } from "@/lib/offline/cola";
import { SyncEngine } from "@/lib/offline/sync";
import { suscribirseACambios } from "@/lib/offline/eventos";
import type {
  ItemColaCosecha,
  ItemColaSalida,
} from "@/lib/offline/tipos";

const ETIQUETA_SALIDA: Record<string, string> = {
  VENTA: "Venta",
  CONSUMO: "Consumo",
  PERDIDA: "Pérdida",
  OTRO: "Otro",
};

export function ListaPendientesAlmacen() {
  const [cosechas, setCosechas] = useState<ItemColaCosecha[]>([]);
  const [salidas, setSalidas] = useState<ItemColaSalida[]>([]);

  useEffect(() => {
    async function refrescar() {
      const t = await listarTodos();
      setCosechas(t.cosechas);
      setSalidas(t.salidas);
    }
    refrescar();
    return suscribirseACambios(refrescar);
  }, []);

  const items = [
    ...cosechas.map((c) => ({ kind: "cosecha" as const, ...c })),
    ...salidas.map((s) => ({ kind: "salida" as const, ...s })),
  ].sort((a, b) => b.creado_en - a.creado_en);

  return (
    <div className="space-y-4 pb-24">
      <Link
        href="/almacen"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Almacén
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Sincronización
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Pendientes</h1>
      </header>

      <button
        type="button"
        onClick={() => SyncEngine.procesarCola()}
        className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-zelanda-verde-300 bg-white px-4 py-2 text-sm font-medium text-zelanda-verde-800"
      >
        <RefreshCw className="h-4 w-4" />
        Sincronizar ahora
      </button>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          No hay registros pendientes.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const titulo =
              it.kind === "cosecha"
                ? `Cosecha · ${it.metodo === "CANASTA" ? "Canasta" : "Báscula"}`
                : `Salida · ${ETIQUETA_SALIDA[it.tipo] ?? it.tipo}`;
            const detalle =
              it.kind === "cosecha"
                ? `${it.peso_kg.toFixed(2)} kg`
                : `${it.cantidad_kg.toFixed(2)} kg${
                    it.cliente_detalle ? ` · ${it.cliente_detalle}` : ""
                  }`;
            const fecha = new Date(it.creado_en).toLocaleString("es-CO");
            return (
              <li
                key={it.id_local}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zelanda-verde-900">{titulo}</p>
                    <p className="text-xs text-zelanda-verde-700">{detalle}</p>
                    <p className="mt-0.5 text-[11px] text-zelanda-verde-700/70">
                      {fecha}
                    </p>
                    {it.estado === "error_permanente" ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-estado-vencida">
                        <AlertTriangle className="h-3 w-3" />
                        {it.ultimo_error ?? "Error de sincronización"}
                      </p>
                    ) : it.estado === "subiendo" ? (
                      <p className="mt-1 text-xs text-zelanda-verde-700">Subiendo…</p>
                    ) : (
                      <p className="mt-1 text-xs text-zelanda-verde-700">Pendiente</p>
                    )}
                  </div>
                  {it.estado === "error_permanente" ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          reintentar(it.kind, it.id_local).then(() =>
                            SyncEngine.procesarCola(),
                          )
                        }
                        className="rounded-md border border-zelanda-verde-300 bg-white px-2 py-1 text-xs text-zelanda-verde-800"
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrarItem(it.kind, it.id_local)}
                        className="inline-flex items-center gap-1 rounded-md border border-estado-vencida/40 bg-white px-2 py-1 text-xs text-estado-vencida"
                      >
                        <Trash2 className="h-3 w-3" />
                        Borrar
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
