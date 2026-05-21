"use client";

import { useActionState, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { actualizarArbol, type EstadoEdicion } from "./acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

const ETIQUETA_ESTADO: Record<string, string> = {
  SALUDABLE: "Saludable",
  CON_NOVEDAD: "Con novedad",
  MUERTO: "Muerto",
  REMOVIDO: "Removido",
};

export function EditorArbol({
  arbolId,
  estadoInicial,
  notasIniciales,
}: {
  arbolId: string;
  estadoInicial: string;
  notasIniciales: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion, pendiente] = useActionState(actualizarArbol, ESTADO_INICIAL);
  const [estadoLocal, setEstadoLocal] = useState(estadoInicial);
  const [notasLocal, setNotasLocal] = useState(notasIniciales ?? "");

  if (estado.ok && editando) {
    // Cerrar al guardar
    setEditando(false);
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
      >
        <Pencil className="h-4 w-4" />
        Editar
      </button>
    );
  }

  return (
    <form action={accion} className="space-y-3 rounded-xl border border-zelanda-verde-300 bg-zelanda-verde-50/50 p-4">
      <input type="hidden" name="arbol_id" value={arbolId} />

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-zelanda-verde-700">
          Estado
        </label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["SALUDABLE", "CON_NOVEDAD", "MUERTO", "REMOVIDO"] as const).map((e) => (
            <label
              key={e}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                estadoLocal === e
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="estado"
                value={e}
                checked={estadoLocal === e}
                onChange={() => setEstadoLocal(e)}
                className="sr-only"
              />
              {ETIQUETA_ESTADO[e]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-zelanda-verde-700">
          Notas
        </label>
        <textarea
          name="notas"
          rows={3}
          value={notasLocal}
          onChange={(e) => setNotasLocal(e.target.value)}
          placeholder="Anotaciones específicas de este árbol (opcional)"
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {estado.error ? (
        <p className="rounded-md bg-estado-vencida/10 px-3 py-2 text-xs text-estado-vencida">
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="inline-flex flex-1 min-h-touch items-center justify-center gap-1.5 rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2 text-sm font-medium text-zelanda-verde-800"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex flex-1 min-h-touch items-center justify-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm font-medium text-zelanda-beige-50 disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {pendiente ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
