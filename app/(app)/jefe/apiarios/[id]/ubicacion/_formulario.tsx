"use client";

import { useActionState } from "react";
import { EditorPuntoCargador } from "@/components/mapa/EditorPuntoCargador";
import {
  guardarCoordsApiario,
  type EstadoEdicion,
} from "@/lib/acciones-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioUbicacionApiario({
  apiarioId,
  inicial,
}: {
  apiarioId: string;
  inicial: [number, number] | null;
}) {
  const [estado, formAction, pending] = useActionState(
    guardarCoordsApiario,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="apiario_id" value={apiarioId} />
      <EditorPuntoCargador inicial={inicial} hiddenName="punto" />
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
        {pending ? "Guardando..." : "Guardar ubicación"}
      </button>
    </form>
  );
}
