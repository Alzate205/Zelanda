"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { crearPago, type EstadoPago } from "../acciones";

const ESTADO_INICIAL: EstadoPago = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Persona = { id: string; nombre: string };

type Tipo = "SALARIO" | "ADELANTO" | "JORNAL" | "SERVICIO" | "BONO" | "AJUSTE" | "OTRO";

const TIPOS: { id: Tipo; etiqueta: string; descripcion: string }[] = [
  { id: "SALARIO", etiqueta: "Salario", descripcion: "Periódico para fijos" },
  { id: "JORNAL", etiqueta: "Jornal", descripcion: "Día trabajado" },
  { id: "SERVICIO", etiqueta: "Servicio", descripcion: "Contrato puntual" },
  { id: "BONO", etiqueta: "Bono", descripcion: "Extra acordado" },
  { id: "ADELANTO", etiqueta: "Adelanto", descripcion: "Pago anticipado" },
  { id: "AJUSTE", etiqueta: "Ajuste", descripcion: "Corrección (+/–)" },
  { id: "OTRO", etiqueta: "Otro", descripcion: "Sin categoría" },
];

function formatearMonto(valor: string): string {
  if (!valor) return "";
  const negativo = valor.startsWith("-");
  const digitos = valor.replace(/[^\d]/g, "");
  if (!digitos) return negativo ? "-" : "";
  const conPuntos = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return negativo ? `-${conPuntos}` : conPuntos;
}

export function FormularioPago({ personas }: { personas: Persona[] }) {
  const [estado, accion, pendiente] = useActionState(crearPago, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<Tipo>("SALARIO");
  const [conPeriodo, setConPeriodo] = useState(false);
  const [monto, setMonto] = useState("");

  const hoy = new Date().toISOString().slice(0, 10);
  const esAjuste = tipo === "AJUSTE";

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      <Link
        href="/jefe/pagos"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Pagos
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Registrar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo pago
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Anotá una salida de plata hacia una persona. Queda en el histórico.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="persona_id" className={labelBase}>
            ¿A quién se le pagó?
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
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {TIPOS.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer flex-col items-start rounded-[10px] border px-3 py-2 transition ${
                  tipo === t.id
                    ? "border-zelanda-verde-700 bg-zelanda-verde-50 text-zelanda-verde-900"
                    : "border-zelanda-beige-300 bg-white text-zelanda-verde-700 hover:bg-zelanda-beige-50"
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.id}
                  checked={tipo === t.id}
                  onChange={() => setTipo(t.id)}
                  className="sr-only"
                />
                <span className="text-[13px] font-semibold">{t.etiqueta}</span>
                <span className="text-[11px] opacity-70">{t.descripcion}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="monto" className={labelBase}>
              Monto (COP)
            </label>
            <input
              id="monto"
              name="monto"
              type="text"
              inputMode={esAjuste ? "text" : "numeric"}
              required
              placeholder={esAjuste ? "puede ser negativo" : "80.000"}
              value={formatearMonto(monto)}
              onChange={(e) => {
                const raw = e.target.value;
                const negativo = esAjuste && raw.trim().startsWith("-");
                const digitos = raw.replace(/[^\d]/g, "");
                setMonto(negativo && digitos ? `-${digitos}` : digitos);
              }}
              className={inputBase}
            />
            {esAjuste ? (
              <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
                Un ajuste puede ser positivo o negativo.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="fecha" className={labelBase}>
              Fecha del pago
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
        </div>

        <div>
          <label htmlFor="metodo_pago" className={labelBase}>
            Método (opcional)
          </label>
          <input
            id="metodo_pago"
            name="metodo_pago"
            type="text"
            list="metodos_pago"
            placeholder="Efectivo, Nequi, Transferencia…"
            className={inputBase}
          />
          <datalist id="metodos_pago">
            <option value="Efectivo" />
            <option value="Nequi" />
            <option value="Daviplata" />
            <option value="Transferencia" />
            <option value="Otro" />
          </datalist>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setConPeriodo(!conPeriodo)}
            className="text-[12.5px] font-semibold text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            {conPeriodo
              ? "− Quitar periodo cubierto"
              : "+ Indicar periodo cubierto (opcional)"}
          </button>
          {conPeriodo ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cubre_desde" className={labelBase}>
                  Cubre desde
                </label>
                <input
                  id="cubre_desde"
                  name="cubre_desde"
                  type="date"
                  className={inputBase}
                />
              </div>
              <div>
                <label htmlFor="cubre_hasta" className={labelBase}>
                  Cubre hasta
                </label>
                <input
                  id="cubre_hasta"
                  name="cubre_hasta"
                  type="date"
                  className={inputBase}
                />
              </div>
            </div>
          ) : null}
        </div>

        {esAjuste ? (
          <div>
            <label htmlFor="motivo_diferencia" className={labelBase}>
              Motivo del ajuste
            </label>
            <input
              id="motivo_diferencia"
              name="motivo_diferencia"
              type="text"
              required={esAjuste}
              placeholder="Ej: descuento herramienta dañada"
              className={inputBase}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            placeholder="Detalles, concepto, recibo, etc."
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
            href="/jefe/pagos"
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
            {pendiente ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </form>
  );
}
