"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { crearAusencia, type EstadoAusencia } from "../acciones";

const ESTADO_INICIAL: EstadoAusencia = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Persona = { id: string; nombre: string };
type Tipo = "FALTA_INJUSTIFICADA" | "INCAPACIDAD" | "VACACIONES" | "LICENCIA" | "PERMISO";

const TIPOS: { id: Tipo; etiqueta: string; descuentaDefault: boolean }[] = [
  { id: "FALTA_INJUSTIFICADA", etiqueta: "Falta injustificada", descuentaDefault: true },
  { id: "INCAPACIDAD", etiqueta: "Incapacidad", descuentaDefault: false },
  { id: "VACACIONES", etiqueta: "Vacaciones", descuentaDefault: false },
  { id: "LICENCIA", etiqueta: "Licencia", descuentaDefault: true },
  { id: "PERMISO", etiqueta: "Permiso", descuentaDefault: true },
];

export function FormularioAusencia({ personas }: { personas: Persona[] }) {
  const [estado, accion, pendiente] = useActionState(
    crearAusencia,
    ESTADO_INICIAL,
  );
  const [tipo, setTipo] = useState<Tipo>("FALTA_INJUSTIFICADA");
  const [descontable, setDescontable] = useState(true);

  const hoy = new Date().toISOString().slice(0, 10);

  function cambiarTipo(nuevoTipo: Tipo) {
    setTipo(nuevoTipo);
    const tipoConfig = TIPOS.find((t) => t.id === nuevoTipo);
    if (tipoConfig) setDescontable(tipoConfig.descuentaDefault);
  }

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <Link
        href="/jefe/ausencias"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Ausencias
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Registrar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva ausencia
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Día no trabajado. Si marca &ldquo;descuenta&rdquo;, reduce los días
          efectivos del mes para el cálculo de salario.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="persona_id" className={labelBase}>
            ¿Quién faltó?
          </label>
          <select
            id="persona_id"
            name="persona_id"
            required
            className={inputBase}
            defaultValue=""
          >
            <option value="">Selecciona persona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelBase}>Tipo</label>
          <div className="mt-1.5 space-y-1.5">
            {TIPOS.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center justify-between rounded-[10px] border px-3 py-2.5 transition ${
                  tipo === t.id
                    ? "border-zelanda-verde-700 bg-zelanda-verde-50"
                    : "border-zelanda-beige-300 bg-white hover:bg-zelanda-beige-50"
                }`}
              >
                <span className="text-[13.5px] font-semibold text-zelanda-verde-900">
                  <input
                    type="radio"
                    name="tipo"
                    value={t.id}
                    checked={tipo === t.id}
                    onChange={() => cambiarTipo(t.id)}
                    className="sr-only"
                  />
                  {t.etiqueta}
                </span>
                <span className="text-[11px] text-zelanda-verde-700/80">
                  {t.descuentaDefault ? "descuenta por default" : "no descuenta por default"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="fecha" className={labelBase}>
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={hoy}
            className={inputBase}
          />
        </div>

        <label className="flex items-start gap-3 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="descontable"
            checked={descontable}
            onChange={(e) => setDescontable(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700 focus:ring-zelanda-verde-600/20"
          />
          <span className="text-sm">
            <span className="block font-medium text-zelanda-verde-900">
              Descuenta del salario
            </span>
            <span className="mt-0.5 block text-[11.5px] text-zelanda-verde-700">
              Si está marcado, este día no se le paga al fijo en el cálculo del
              salario del mes.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="observaciones" className={labelBase}>
            Observaciones (opcional)
          </label>
          <textarea
            id="observaciones"
            name="observaciones"
            rows={2}
            placeholder="Motivo, detalles, certificados, etc."
            className={`${inputBase} min-h-[60px] resize-y py-2.5`}
          />
        </div>
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-estado-vencida/30 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <Link
            href="/jefe/ausencias"
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendiente}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Check className="h-[18px] w-[18px]" />
            {pendiente ? "Registrando…" : "Registrar ausencia"}
          </button>
        </div>
      </div>
    </form>
  );
}
