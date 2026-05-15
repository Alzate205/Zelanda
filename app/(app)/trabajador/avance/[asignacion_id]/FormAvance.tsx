"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { registrarAvance, type EstadoAvance } from "./acciones";

const ESTADO_INICIAL: EstadoAvance = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Asignacion = {
  id: string;
  tipoTarea: string;
  area: "CULTIVO" | "APICULTURA";
  loteNombre: string | null;
  totalArboles: number | null;
  arbolesCompletados: number;
  ultimoArbolTrabajado: number;
  apiarioNombre: string | null;
  totalColmenas: number | null;
};

export function FormAvance({ asignacion }: { asignacion: Asignacion }) {
  const [estado, accion, pendiente] = useActionState(registrarAvance, ESTADO_INICIAL);
  const esCultivo = asignacion.area === "CULTIVO";
  const [tipo, setTipo] = useState<"TRAMO" | "SUELTOS">("TRAMO");

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="asignacion_id" value={asignacion.id} />

      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          {esCultivo ? `Lote ${asignacion.loteNombre}` : `Apiario ${asignacion.apiarioNombre}`}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {asignacion.tipoTarea}
        </h1>
        {esCultivo && asignacion.totalArboles !== null ? (
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Progreso: {asignacion.arbolesCompletados} / {asignacion.totalArboles} árboles
            {asignacion.ultimoArbolTrabajado > 0 ? (
              <> · último: árbol {asignacion.ultimoArbolTrabajado}</>
            ) : null}
          </p>
        ) : null}
      </header>

      {esCultivo ? (
        <>
          <input type="hidden" name="tipo_registro" value={tipo} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("TRAMO")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "TRAMO"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Tramo
            </button>
            <button
              type="button"
              onClick={() => setTipo("SUELTOS")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "SUELTOS"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Sueltos
            </button>
          </div>

          <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
            {tipo === "TRAMO" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="desde" className={labelBase}>Desde árbol</label>
                  <input id="desde" name="desde" type="number" min="1" required className={inputBase} />
                </div>
                <div>
                  <label htmlFor="hasta" className={labelBase}>Hasta árbol</label>
                  <input id="hasta" name="hasta" type="number" min="1" required className={inputBase} />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="lista" className={labelBase}>
                  Números de árboles (separados por coma o espacio)
                </label>
                <textarea
                  id="lista"
                  name="lista"
                  rows={3}
                  required
                  placeholder="12, 45, 67, 89"
                  className={`${inputBase} min-h-[80px] resize-y`}
                />
              </div>
            )}

            <div>
              <label htmlFor="observaciones" className={labelBase}>Notas (opcional)</label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={2}
                className={`${inputBase} min-h-[60px] resize-y`}
              />
            </div>
          </section>
        </>
      ) : (
        <>
          <input type="hidden" name="tipo_registro" value="VISITA" />
          <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
            {asignacion.totalColmenas !== null ? (
              <p className="text-sm text-zelanda-verde-700">
                {asignacion.totalColmenas} colmenas registradas.
              </p>
            ) : null}
            <div>
              <label htmlFor="observaciones" className={labelBase}>
                Observaciones (qué se hizo, hallazgos, kg de miel, etc.)
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={4}
                required
                className={`${inputBase} min-h-[100px] resize-y`}
              />
            </div>
            <p className="text-xs text-zelanda-verde-700">
              Al registrar, la asignación queda completada.
            </p>
          </section>
        </>
      )}

      {estado.error ? (
        <p role="alert" className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/trabajador"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
