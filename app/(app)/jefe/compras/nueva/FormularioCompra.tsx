"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Plus, X } from "lucide-react";
import { crearCompra, type EstadoCompra } from "../acciones";
import { formatearMiles, normalizarEntradaNumerica } from "@/lib/formatos";

const ESTADO_INICIAL: EstadoCompra = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Proveedor = { id: string; nombre: string };
type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  costo_unitario: number | null;
};

type Item = {
  insumo_id: string;
  cantidad: string;
  costo_unitario: string;
  notas: string;
};

function nuevoItem(): Item {
  return { insumo_id: "", cantidad: "", costo_unitario: "", notas: "" };
}

function fmtMonto(n: number): string {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export function FormularioCompra({
  proveedores,
  insumos,
}: {
  proveedores: Proveedor[];
  insumos: Insumo[];
}) {
  const [estado, accion, pendiente] = useActionState(crearCompra, ESTADO_INICIAL);
  const [modoProveedor, setModoProveedor] = useState<"existente" | "nuevo">(
    proveedores.length > 0 ? "existente" : "nuevo",
  );
  const [items, setItems] = useState<Item[]>([nuevoItem()]);

  const hoy = new Date().toISOString().slice(0, 10);

  const total = useMemo(() => {
    return items.reduce((acc, it) => {
      const c = Number(it.cantidad.replace(/\./g, ""));
      const cu = Number(it.costo_unitario.replace(/\./g, ""));
      if (!Number.isFinite(c) || !Number.isFinite(cu)) return acc;
      return acc + c * cu;
    }, 0);
  }, [items]);

  function actualizarItem(idx: number, parche: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...parche } : it)),
    );
  }

  function agregarItem() {
    setItems((prev) => [...prev, nuevoItem()]);
  }

  function quitarItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function elegirInsumo(idx: number, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    actualizarItem(idx, {
      insumo_id: insumoId,
      // Pre-llenar costo si el insumo tiene uno registrado
      costo_unitario:
        items[idx].costo_unitario === "" && insumo?.costo_unitario != null
          ? String(Math.round(insumo.costo_unitario))
          : items[idx].costo_unitario,
    });
  }

  // Payload JSON para el server
  const itemsJson = JSON.stringify(
    items
      .filter((it) => it.insumo_id && it.cantidad && it.costo_unitario)
      .map((it) => ({
        insumo_id: it.insumo_id,
        cantidad: Number(it.cantidad.replace(/\./g, "")),
        costo_unitario: Number(it.costo_unitario.replace(/\./g, "")),
        notas: it.notas || undefined,
      })),
  );

  return (
    <form action={accion} className="space-y-5 pb-32" noValidate>
      <Link
        href="/jefe/compras"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Compras
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Registrar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva compra
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          El stock de los insumos se actualiza automáticamente al guardar.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label className={labelBase}>Proveedor</label>
          <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
            <button
              type="button"
              onClick={() => setModoProveedor("existente")}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                modoProveedor === "existente"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700"
              }`}
            >
              Ya registrado
            </button>
            <button
              type="button"
              onClick={() => setModoProveedor("nuevo")}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                modoProveedor === "nuevo"
                  ? "bg-white text-zelanda-verde-900 shadow-suave"
                  : "text-zelanda-verde-700"
              }`}
            >
              Nuevo
            </button>
          </div>
          {modoProveedor === "existente" ? (
            <select
              name="proveedor_id"
              required={modoProveedor === "existente"}
              className={`${inputBase} mt-2`}
              defaultValue=""
            >
              <option value="">Selecciona proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                name="proveedor_nuevo_nombre"
                type="text"
                required={modoProveedor === "nuevo"}
                placeholder="Nombre del proveedor"
                className={`${inputBase} mt-2`}
              />
              <p className="mt-1 text-[11px] text-zelanda-verde-700/70">
                Se crea como proveedor activo al guardar.
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label htmlFor="numero_factura" className={labelBase}>
              Factura # (opcional)
            </label>
            <input
              id="numero_factura"
              name="numero_factura"
              type="text"
              className={inputBase}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">Items</h2>
          <button
            type="button"
            onClick={agregarItem}
            className="inline-flex items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 py-1.5 text-[12px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            <Plus className="h-3 w-3" /> Agregar
          </button>
        </div>

        {items.map((it, idx) => {
          const insumo = insumos.find((i) => i.id === it.insumo_id);
          const c = Number(it.cantidad.replace(/\./g, ""));
          const cu = Number(it.costo_unitario.replace(/\./g, ""));
          const subtotal =
            Number.isFinite(c) && Number.isFinite(cu) ? c * cu : 0;
          return (
            <div
              key={idx}
              className="rounded-[12px] border border-zelanda-beige-200 bg-zelanda-beige-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
                  Item {idx + 1}
                </span>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => quitarItem(idx)}
                    className="text-zelanda-verde-700 hover:text-estado-vencida"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <select
                value={it.insumo_id}
                onChange={(e) => elegirInsumo(idx, e.target.value)}
                className={`${inputBase} mt-1.5`}
                required
              >
                <option value="">Selecciona insumo…</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad})
                  </option>
                ))}
              </select>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
                    Cantidad {insumo ? `(${insumo.unidad})` : ""}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatearMiles(it.cantidad)}
                    onChange={(e) =>
                      actualizarItem(idx, {
                        cantidad: normalizarEntradaNumerica(e.target.value),
                      })
                    }
                    placeholder="10"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
                    Costo unitario
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatearMiles(it.costo_unitario)}
                    onChange={(e) =>
                      actualizarItem(idx, {
                        costo_unitario: normalizarEntradaNumerica(
                          e.target.value,
                        ),
                      })
                    }
                    placeholder="50.000"
                    className={inputBase}
                  />
                </div>
              </div>

              <input
                type="text"
                value={it.notas}
                onChange={(e) => actualizarItem(idx, { notas: e.target.value })}
                placeholder="Notas (opcional)"
                className={`${inputBase} mt-2`}
              />

              {subtotal > 0 ? (
                <p className="mt-2 text-right text-[13px] font-semibold text-zelanda-verde-900">
                  Subtotal: {fmtMonto(subtotal)}
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-[10px] bg-zelanda-verde-50 px-3 py-2.5">
          <span className="font-serif text-[14px] text-zelanda-verde-900">
            Total
          </span>
          <span className="font-serif text-[18px] text-zelanda-verde-900">
            {fmtMonto(total)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <label htmlFor="notas" className={labelBase}>
          Notas de la compra (opcional)
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          placeholder="Observaciones generales, condiciones, etc."
          className={`${inputBase} min-h-[60px] resize-y py-2.5`}
        />
      </section>

      {/* Items JSON oculto para el server */}
      <input type="hidden" name="items" value={itemsJson} />

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
            href="/jefe/compras"
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pendiente || total === 0}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Check className="h-[18px] w-[18px]" />
            {pendiente ? "Registrando…" : `Registrar ${fmtMonto(total)}`}
          </button>
        </div>
      </div>
    </form>
  );
}
