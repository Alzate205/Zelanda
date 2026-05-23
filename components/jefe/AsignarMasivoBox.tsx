"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import {
  crearAsignacionesMasivas,
  type ResultadoMasivo,
} from "@/app/(app)/jefe/asignaciones/acciones";

type Persona = { id: string; nombre: string };

export function AsignarMasivoBox({
  tipoTareaId,
  kind,
  destinoIds,
  personas,
}: {
  tipoTareaId: string;
  kind: "lote" | "apiario";
  destinoIds: string[];
  personas: Persona[];
}) {
  const router = useRouter();
  const [personaId, setPersonaId] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoMasivo | null>(null);

  function handleClick() {
    if (!personaId) return;
    setResultado(null);
    startTransition(async () => {
      const r = await crearAsignacionesMasivas({
        tipo_tarea_id: tipoTareaId,
        persona_id: personaId,
        destinos: destinoIds.map((id) => ({ kind, id })),
      });
      setResultado(r);
      if (r.error === null && r.creadas > 0) {
        router.refresh();
      }
    });
  }

  if (personas.length === 0) {
    return (
      <p className="rounded-md border border-zelanda-beige-300 bg-zelanda-beige-50 px-3 py-2 text-xs text-zelanda-verde-700">
        No hay personas activas para asignar.
      </p>
    );
  }

  const exitoso = resultado && resultado.error === null && resultado.creadas > 0;

  return (
    <div className="rounded-lg border border-zelanda-verde-300 bg-zelanda-verde-50/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-zelanda-verde-800">
        <UserPlus className="h-3.5 w-3.5" />
        Asignar todos a:
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={personaId}
          onChange={(e) => {
            setPersonaId(e.target.value);
            setResultado(null);
          }}
          disabled={pendiente}
          className="min-h-touch flex-1 rounded-lg border border-zelanda-beige-300 bg-white px-2 py-1.5 text-sm text-zelanda-verde-900"
        >
          <option value="">Selecciona persona…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleClick}
          disabled={!personaId || pendiente}
          className="min-h-touch shrink-0 rounded-lg bg-zelanda-verde-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendiente
            ? "Creando…"
            : `Asignar ${destinoIds.length}`}
        </button>
      </div>
      {resultado ? (
        resultado.error ? (
          <p className="mt-2 rounded-md bg-estado-vencida/10 px-2 py-1 text-xs text-estado-vencida">
            {resultado.error}
          </p>
        ) : (
          <p
            className={`mt-2 rounded-md px-2 py-1 text-xs ${
              exitoso
                ? "bg-zelanda-verde-100 text-zelanda-verde-800"
                : "bg-zelanda-beige-100 text-zelanda-verde-700"
            }`}
          >
            {resultado.creadas} asignación
            {resultado.creadas === 1 ? "" : "es"} creada
            {resultado.creadas === 1 ? "" : "s"}
            {resultado.duplicadas > 0
              ? ` · ${resultado.duplicadas} ya estaban abiertas (omitidas)`
              : ""}
          </p>
        )
      ) : null}
    </div>
  );
}
