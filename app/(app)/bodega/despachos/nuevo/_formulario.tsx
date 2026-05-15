"use client";

import { useActionState, useState, useMemo } from "react";
import { Trash2, Wrench, FlaskConical } from "lucide-react";
import { crearDespacho, type EstadoEdicion } from "../acciones";

type Persona = { id: string; nombre: string };
type Herramienta = { id: string; nombre: string; total: number };
type Insumo = { id: string; nombre: string; unidad: string; disponible: number };
type Asignacion = { id: string; persona_id: string; etiqueta: string };

type ItemRow = {
  uid: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  ref_id: string;
  cantidad: string;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioDespacho({
  personas,
  herramientas,
  insumos,
  asignaciones,
}: {
  personas: Persona[];
  herramientas: Herramienta[];
  insumos: Insumo[];
  asignaciones: Asignacion[];
}) {
  const [estado, formAction, pending] = useActionState(
    crearDespacho,
    ESTADO_INICIAL,
  );
  const [personaId, setPersonaId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const asignacionesFiltradas = useMemo(
    () => asignaciones.filter((a) => a.persona_id === personaId),
    [asignaciones, personaId],
  );

  const agregarItem = (tipo: "HERRAMIENTA" | "INSUMO") => {
    setItems((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        tipo,
        ref_id: "",
        cantidad: "",
      },
    ]);
  };

  const actualizarItem = (uid: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };

  const eliminarItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Trabajador
        </label>
        <select
          name="persona_id"
          required
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {personaId && (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Asignación (opcional)
          </label>
          <select
            name="asignacion_id"
            defaultValue=""
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          >
            <option value="">Sin asignación</option>
            {asignacionesFiltradas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zelanda-verde-900">
            Items ({items.length})
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => agregarItem("HERRAMIENTA")}
              className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1 text-xs text-zelanda-verde-700"
            >
              <Wrench className="h-3.5 w-3.5" /> + Herramienta
            </button>
            <button
              type="button"
              onClick={() => agregarItem("INSUMO")}
              className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1 text-xs text-zelanda-verde-700"
            >
              <FlaskConical className="h-3.5 w-3.5" /> + Insumo
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Agrega al menos un item.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {items.map((it) => (
              <li
                key={it.uid}
                className="rounded-lg border border-zelanda-beige-200 p-3"
              >
                <div className="flex items-center justify-between text-xs text-zelanda-verde-700">
                  <span className="font-medium">
                    {it.tipo === "HERRAMIENTA" ? "Herramienta" : "Insumo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminarItem(it.uid)}
                    className="text-estado-vencida"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    required
                    value={it.ref_id}
                    onChange={(e) =>
                      actualizarItem(it.uid, { ref_id: e.target.value })
                    }
                    className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  >
                    <option value="">Selecciona...</option>
                    {it.tipo === "HERRAMIENTA"
                      ? herramientas.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nombre} (×{h.total})
                          </option>
                        ))
                      : insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre} ({i.disponible} {i.unidad})
                          </option>
                        ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    min={it.tipo === "HERRAMIENTA" ? "1" : "0.001"}
                    step={it.tipo === "HERRAMIENTA" ? "1" : "0.001"}
                    required
                    value={it.cantidad}
                    onChange={(e) =>
                      actualizarItem(it.uid, { cantidad: e.target.value })
                    }
                    className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || items.length === 0 || !personaId}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Despachando..." : "Despachar"}
      </button>
    </form>
  );
}
