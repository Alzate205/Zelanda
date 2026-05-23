"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { listarTodos, borrarItem, reintentar } from "@/lib/offline/cola";
import { SyncEngine } from "@/lib/offline/sync";
import { suscribirseACambios } from "@/lib/offline/eventos";
import type { ItemColaAvance, ItemColaNovedad } from "@/lib/offline/tipos";

const ETIQUETA_NOV: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export function ListaPendientesCliente() {
  const [avances, setAvances] = useState<ItemColaAvance[]>([]);
  const [novedades, setNovedades] = useState<ItemColaNovedad[]>([]);

  useEffect(() => {
    async function refrescar() {
      const t = await listarTodos();
      setAvances(t.avances);
      setNovedades(t.novedades);
    }
    refrescar();
    return suscribirseACambios(refrescar);
  }, []);

  const items = [
    ...avances.map((a) => ({ kind: "avance" as const, ...a })),
    ...novedades.map((n) => ({ kind: "novedad" as const, ...n })),
  ].sort((a, b) => b.creado_en - a.creado_en);

  const conErrores = items.filter((it) => it.estado === "error_permanente").length;

  return (
    <div className="space-y-5 pb-24">
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Sincronización
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Pendientes
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          {items.length} {items.length === 1 ? "registro" : "registros"}
          {conErrores > 0 ? ` · ${conErrores} con error` : ""}
        </p>
      </header>

      <button
        type="button"
        onClick={() => SyncEngine.procesarCola()}
        className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
      >
        <RefreshCw className="h-4 w-4" />
        Sincronizar ahora
      </button>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          No hay registros pendientes.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const esError = it.estado === "error_permanente";
            const subiendo = it.estado === "subiendo";
            const borde = esError
              ? "border-l-estado-vencida"
              : subiendo
                ? "border-l-zelanda-verde-500"
                : "border-l-zelanda-ocre-400";
            const titulo =
              it.kind === "avance"
                ? `Avance · ${it.tipo_registro}`
                : `Novedad · ${ETIQUETA_NOV[it.tipo] ?? it.tipo}`;
            const detalle =
              it.kind === "avance"
                ? it.tipo_registro === "TRAMO"
                  ? `Tramo ${it.arbol_desde}–${it.arbol_hasta}`
                  : it.tipo_registro === "SUELTOS"
                    ? `${it.arboles_lista.length} árbol${
                        it.arboles_lista.length === 1 ? "" : "es"
                      }`
                    : "Visita al apiario"
                : `Árbol ${it.numero_placa} · ${it.descripcion.slice(0, 60)}`;
            const fecha = new Date(it.creado_en).toLocaleString("es-CO");
            return (
              <li
                key={it.id_local}
                className={`rounded-xl border border-l-[3px] border-zelanda-beige-200 bg-white p-3.5 shadow-suave ${borde}`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-serif text-[14.5px] text-zelanda-verde-900">
                      {titulo}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                      {detalle}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-zelanda-verde-700/70">
                      {fecha}
                    </p>
                    {esError ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-estado-vencida">
                        <AlertTriangle className="h-3 w-3" />
                        {it.ultimo_error ?? "Error de sincronización"}
                      </p>
                    ) : subiendo ? (
                      <p className="mt-1 text-[11.5px] text-zelanda-verde-700">
                        Subiendo…
                      </p>
                    ) : (
                      <p className="mt-1 text-[11.5px] text-zelanda-verde-700">
                        Pendiente
                      </p>
                    )}
                  </div>
                  {esError ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          reintentar(it.kind, it.id_local).then(() =>
                            SyncEngine.procesarCola(),
                          )
                        }
                        className="rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-2.5 py-1 text-[11.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrarItem(it.kind, it.id_local)}
                        className="inline-flex items-center gap-1 rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-2.5 py-1 text-[11.5px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
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
