"use client";

import { useActionState } from "react";
import { EditorPuntoCargador } from "@/components/mapa/EditorPuntoCargador";
import {
  guardarCoordsInstalacion,
  type EstadoEdicion,
} from "@/lib/acciones-mapa";
import type { ReferenciasMapa } from "@/lib/referencias-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioUbicacionInstalacion({
  instalacionId,
  inicial,
  referencias,
}: {
  instalacionId: string;
  inicial: [number, number] | null;
  referencias?: ReferenciasMapa;
}) {
  const [estado, formAction, pending] = useActionState(
    guardarCoordsInstalacion,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="instalacion_id" value={instalacionId} />
      <EditorPuntoCargador
        inicial={inicial}
        hiddenName="punto"
        referencias={referencias}
      />
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
