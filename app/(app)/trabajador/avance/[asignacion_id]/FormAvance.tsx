"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CloudOff } from "lucide-react";
import { enviarAvance } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { EstadoApiario } from "@/lib/offline/tipos";

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Asignacion = {
  id: string;
  tipoTarea: string;
  area: "CULTIVO" | "APICULTURA";
  esCosechaMiel: boolean;
  loteNombre: string | null;
  totalArboles: number | null;
  arbolesCompletados: number;
  ultimoArbolTrabajado: number;
  apiarioNombre: string | null;
  totalColmenas: number | null;
};

function parsearListaNumeros(raw: string): number[] | null {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n <= 0) return null;
    nums.push(n);
  }
  return nums;
}

const ESTADOS_APIARIO: Array<{
  value: EstadoApiario;
  etiqueta: string;
  color: string;
}> = [
  { value: "BIEN", etiqueta: "Bien", color: "bg-estado-aldia text-white border-estado-aldia" },
  { value: "CON_PROBLEMAS", etiqueta: "Con problemas", color: "bg-estado-proxima text-white border-estado-proxima" },
  { value: "CRITICO", etiqueta: "Crítico", color: "bg-estado-vencida text-white border-estado-vencida" },
];

export function FormAvance({ asignacion }: { asignacion: Asignacion }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const esCultivo = asignacion.area === "CULTIVO";
  const esCosechaMiel = asignacion.esCosechaMiel;
  const esVisitaApiario = !esCultivo && !esCosechaMiel;
  const [tipo, setTipo] = useState<"TRAMO" | "SUELTOS">("TRAMO");
  const [estadoApiario, setEstadoApiario] = useState<EstadoApiario | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

    if (esCosechaMiel) {
      const kg = Number(String(formData.get("kg") ?? "").trim());
      if (!Number.isFinite(kg) || kg <= 0) {
        setError("Los kilos cosechados deben ser positivos.");
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/trabajador/cosecha-miel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asignacion_id: asignacion.id,
            kg,
            notas: observaciones,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Error ${res.status}`);
          return;
        }
        router.push(`/trabajador/exito/${asignacion.id}`);
      });
      return;
    }

    if (esVisitaApiario) {
      if (!estadoApiario) {
        setError("Indicá el estado general del apiario.");
        return;
      }
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "VISITA",
          arbol_desde: null,
          arbol_hasta: null,
          arboles_lista: [],
          observaciones,
          estado_apiario: estadoApiario,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push(`/trabajador/exito/${asignacion.id}`);
      });
      return;
    }

    if (tipo === "TRAMO") {
      const d = parseInt(String(formData.get("desde") ?? ""), 10);
      const h = parseInt(String(formData.get("hasta") ?? ""), 10);
      if (!Number.isInteger(d) || !Number.isInteger(h) || d < 1 || h < 1) {
        setError("Desde y hasta deben ser enteros positivos.");
        return;
      }
      if (asignacion.totalArboles && (d > asignacion.totalArboles || h > asignacion.totalArboles)) {
        setError(`Los números deben estar entre 1 y ${asignacion.totalArboles}.`);
        return;
      }
      if (d > h) {
        setError("Desde no puede ser mayor que Hasta.");
        return;
      }
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "TRAMO",
          arbol_desde: d,
          arbol_hasta: h,
          arboles_lista: [],
          observaciones,
          estado_apiario: null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push(`/trabajador/exito/${asignacion.id}`);
      });
    } else {
      const lista = parsearListaNumeros(String(formData.get("lista") ?? ""));
      if (!lista || lista.length === 0) {
        setError("Lista de números inválida o vacía.");
        return;
      }
      if (asignacion.totalArboles) {
        const fuera = lista.filter((n) => n > asignacion.totalArboles!);
        if (fuera.length > 0) {
          setError(`Algunos números superan el total (${asignacion.totalArboles}).`);
          return;
        }
      }
      startTransition(async () => {
        const r = await enviarAvance({
          asignacion_id: asignacion.id,
          tipo_registro: "SUELTOS",
          arbol_desde: null,
          arbol_hasta: null,
          arboles_lista: lista,
          observaciones,
          estado_apiario: null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push(`/trabajador/exito/${asignacion.id}`);
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          {esCultivo ? `Lote ${asignacion.loteNombre}` : `Apiario ${asignacion.apiarioNombre}`}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">{asignacion.tipoTarea}</h1>
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
          <div className="grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <button
              type="button"
              onClick={() => setTipo("TRAMO")}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                tipo === "TRAMO"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700 hover:text-zelanda-verde-900"
              }`}
            >
              Tramo
            </button>
            <button
              type="button"
              onClick={() => setTipo("SUELTOS")}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                tipo === "SUELTOS"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700 hover:text-zelanda-verde-900"
              }`}
            >
              Sueltos
            </button>
          </div>

          <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
            {tipo === "TRAMO" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="desde" className={labelBase}>Desde árbol</label>
                  <input id="desde" name="desde" type="number" inputMode="numeric" pattern="[0-9]*" min="1" required className={inputBase} />
                </div>
                <div>
                  <label htmlFor="hasta" className={labelBase}>Hasta árbol</label>
                  <input id="hasta" name="hasta" type="number" inputMode="numeric" pattern="[0-9]*" min="1" required className={inputBase} />
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
      ) : esCosechaMiel ? (
        <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          {asignacion.totalColmenas !== null ? (
            <p className="text-sm text-zelanda-verde-700">
              {asignacion.totalColmenas} colmenas en el apiario.
            </p>
          ) : null}
          <div>
            <label htmlFor="kg" className={labelBase}>
              Kg de miel cosechados
            </label>
            <input
              id="kg"
              name="kg"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="observaciones" className={labelBase}>
              Notas (opcional)
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              className={`${inputBase} min-h-[80px] resize-y`}
            />
          </div>
          <p className="text-xs text-zelanda-verde-700">
            Al registrar, la asignación queda completada.
          </p>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          {asignacion.totalColmenas !== null ? (
            <p className="text-sm text-zelanda-verde-700">
              {asignacion.totalColmenas} colmenas en el apiario.
            </p>
          ) : null}

          <div>
            <p className={labelBase}>Estado general del apiario</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ESTADOS_APIARIO.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEstadoApiario(e.value)}
                  className={`min-h-touch rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    estadoApiario === e.value
                      ? e.color
                      : "border-zelanda-beige-300 bg-white text-zelanda-verde-800"
                  }`}
                >
                  {e.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="observaciones" className={labelBase}>
              Observaciones (qué se hizo, hallazgos)
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={4}
              className={`${inputBase} min-h-[100px] resize-y`}
            />
          </div>
          <p className="text-xs text-zelanda-verde-700">
            Al registrar, la asignación queda completada.
          </p>
        </section>
      )}

      {!online && !esCosechaMiel ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — el avance se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {!online && esCosechaMiel ? (
        <p className="flex items-center gap-2 rounded-md border border-estado-vencida/40 bg-estado-vencida/10 px-3 py-2 text-xs text-estado-vencida">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la cosecha de miel requiere conexión, conectate antes de registrar.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Link
          href="/trabajador"
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente || (esCosechaMiel && !online)}
          className="flex min-h-touch flex-[1.4] items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          {pendiente ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
