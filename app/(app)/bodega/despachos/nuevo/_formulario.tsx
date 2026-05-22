"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, FlaskConical, Trash2, Wrench } from "lucide-react";
import { enviarDespachoCrear } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState("");
  const [asignacionId, setAsignacionId] = useState("");
  const [notas, setNotas] = useState("");
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!personaId) {
      setError("Selecciona un trabajador.");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un item al despacho.");
      return;
    }
    for (const it of items) {
      if (!/^\d+$/.test(it.ref_id)) {
        setError("Selecciona un item válido en cada fila.");
        return;
      }
      const c = Number(it.cantidad);
      if (!Number.isFinite(c) || c <= 0) {
        setError("Cantidad inválida en uno de los items.");
        return;
      }
    }

    startTransition(async () => {
      const r = await enviarDespachoCrear({
        persona_id: personaId,
        asignacion_id: asignacionId || null,
        items: items.map((i) => ({
          tipo: i.tipo,
          ref_id: i.ref_id,
          cantidad: Number(i.cantidad),
        })),
        notas: notas.trim() || null,
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
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Trabajador
        </label>
        <select
          name="persona_id"
          required
          value={personaId}
          onChange={(e) => {
            setPersonaId(e.target.value);
            setAsignacionId("");
          }}
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
            value={asignacionId}
            onChange={(e) => setAsignacionId(e.target.value)}
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
                      : insumos
                          .filter((i) => i.disponible > 0)
                          .map((i) => (
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

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — el despacho se guardará y subirá al volver la conexión.
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
        disabled={pendiente || items.length === 0 || !personaId}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pendiente ? "Despachando..." : "Despachar"}
      </button>
    </form>
  );
}
