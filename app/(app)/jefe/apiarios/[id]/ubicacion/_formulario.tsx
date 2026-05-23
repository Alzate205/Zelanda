"use client";

import { useActionState } from "react";
import { EditorPuntoCargador } from "@/components/mapa/EditorPuntoCargador";
import {
  guardarCoordsApiario,
  type EstadoEdicion,
} from "@/lib/acciones-mapa";
import type { ReferenciasMapa } from "@/lib/referencias-mapa";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioUbicacionApiario({
  apiarioId,
  inicial,
  referencias,
}: {
  apiarioId: string;
  inicial: [number, number] | null;
  referencias?: ReferenciasMapa;
}) {
  const [estado, formAction, pending] = useActionState(
    guardarCoordsApiario,
    ESTADO_INICIAL,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="apiario_id" value={apiarioId} />
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
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {pending ? "Guardando..." : "Guardar ubicación"}
      </button>
    </form>
  );
}
