"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import {
  crearProveedor,
  actualizarProveedor,
  type EstadoProveedor,
} from "./acciones";

const ESTADO_INICIAL: EstadoProveedor = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase =
  "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Proveedor = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  nit: string | null;
  notas: string | null;
  activo: boolean;
};

export function FormularioProveedor({
  modo,
  proveedor,
}: {
  modo: "crear" | "editar";
  proveedor?: Proveedor;
}) {
  const accionElegida =
    modo === "crear" ? crearProveedor : actualizarProveedor;
  const [estado, accion, pendiente] = useActionState(
    accionElegida,
    ESTADO_INICIAL,
  );
  const [activo, setActivo] = useState(proveedor?.activo ?? true);

  const titulo = modo === "crear" ? "Nuevo proveedor" : "Editar proveedor";
  const subtitulo =
    modo === "crear"
      ? "Registrá a quién le comprás insumos."
      : "Actualizá los datos o desactivá si ya no es proveedor.";

  return (
    <form action={accion} className="space-y-5 pb-24" noValidate>
      {proveedor ? (
        <input type="hidden" name="id" value={proveedor.id} />
      ) : null}

      <Link
        href="/jefe/proveedores"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Proveedores
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          {modo === "crear" ? "Registrar" : "Editar"}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {titulo}
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">{subtitulo}</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div>
          <label htmlFor="nombre" className={labelBase}>
            Nombre <span className="text-estado-vencida">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={proveedor?.nombre ?? ""}
            placeholder="Ej. Agroinsumos del Quindío"
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nit" className={labelBase}>
              NIT (opcional)
            </label>
            <input
              id="nit"
              name="nit"
              type="text"
              defaultValue={proveedor?.nit ?? ""}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelBase}>
              Teléfono (opcional)
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              defaultValue={proveedor?.telefono ?? ""}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor="contacto" className={labelBase}>
            Contacto (opcional)
          </label>
          <input
            id="contacto"
            name="contacto"
            type="text"
            defaultValue={proveedor?.contacto ?? ""}
            placeholder="Nombre de la persona de contacto"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas (opcional)
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            defaultValue={proveedor?.notas ?? ""}
            placeholder="Productos que vende, acuerdos, dirección, etc."
            className={`${inputBase} min-h-[80px] resize-y py-2.5`}
          />
        </div>

        {modo === "editar" ? (
          <label className="flex items-start gap-3 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-50 p-3">
            <input
              type="checkbox"
              name="activo"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700 focus:ring-zelanda-verde-600/20"
            />
            <span className="text-sm">
              <span className="block font-medium text-zelanda-verde-900">
                Proveedor activo
              </span>
              <span className="mt-0.5 block text-[11.5px] text-zelanda-verde-700">
                Desmarcá si ya no le comprás. Las compras anteriores se
                preservan.
              </span>
            </span>
          </label>
        ) : null}
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
            href="/jefe/proveedores"
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
            {pendiente
              ? "Guardando…"
              : modo === "crear"
                ? "Crear proveedor"
                : "Guardar cambios"}
          </button>
        </div>
      </div>
    </form>
  );
}
