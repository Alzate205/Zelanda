"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarPersonaYVinculacion, type EstadoEdicion } from "../acciones";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import type { TipoVinculacion } from "@/types";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type ModoVinculacion = "dejar" | "cambiar" | "cerrar";

type Persona = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  notas: string | null;
};

type VinculacionActiva = {
  tipo: TipoVinculacion;
  rol_finca: string | null;
} | null;

export function FormularioEditarMiembro({
  persona,
  vincActiva,
}: {
  persona: Persona;
  vincActiva: VinculacionActiva;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarPersonaYVinculacion,
    ESTADO_INICIAL,
  );
  const [modo, setModo] = useState<ModoVinculacion>("dejar");
  const [nuevoTipo, setNuevoTipo] = useState<TipoVinculacion>("FIJO");

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="persona_id" value={persona.id} />
      <input type="hidden" name="modo_vinculacion" value={modo} />

      <Link
        href={`/jefe/equipo/${persona.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {persona.nombre_completo}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {persona.nombre_completo}
        </h1>
      </header>

      {/* Datos */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos personales
        </h2>
        <div>
          <label htmlFor="nombre_completo" className={labelBase}>
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            type="text"
            required
            defaultValue={persona.nombre_completo}
            className={inputBase}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cedula" className={labelBase}>Cédula</label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              defaultValue={persona.cedula ?? ""}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelBase}>Teléfono</label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              defaultValue={persona.telefono ?? ""}
              className={inputBase}
            />
          </div>
        </div>
        <div>
          <label htmlFor="notas" className={labelBase}>Notas</label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            defaultValue={persona.notas ?? ""}
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>
      </section>

      {/* Vinculación */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación
        </h2>
        <p className="text-sm text-zelanda-verde-700">
          Activa actualmente:{" "}
          <span className="font-medium text-zelanda-verde-900">
            {vincActiva
              ? ETIQUETA_TIPO_VINCULACION[vincActiva.tipo] +
                (vincActiva.rol_finca ? ` (${vincActiva.rol_finca})` : "")
              : "Sin vinculación"}
          </span>
        </p>

        <fieldset className="space-y-2">
          <legend className="sr-only">¿Qué hacer con la vinculación?</legend>

          <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
            <input
              type="radio"
              name="modo_visible"
              value="dejar"
              checked={modo === "dejar"}
              onChange={() => setModo("dejar")}
              className="mt-0.5 h-4 w-4 border-zelanda-beige-300 text-zelanda-verde-700"
            />
            <span className="text-sm">
              <span className="font-medium text-zelanda-verde-900">
                Dejarla como está
              </span>
              <span className="mt-0.5 block text-xs text-zelanda-verde-700">
                Solo edito los datos personales.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
            <input
              type="radio"
              name="modo_visible"
              value="cambiar"
              checked={modo === "cambiar"}
              onChange={() => setModo("cambiar")}
              disabled={!vincActiva}
              className="mt-0.5 h-4 w-4 border-zelanda-beige-300 text-zelanda-verde-700"
            />
            <span className="text-sm">
              <span className="font-medium text-zelanda-verde-900">
                Cambiar a otro tipo
              </span>
              <span className="mt-0.5 block text-xs text-zelanda-verde-700">
                Cierra la vinculación activa con la fecha de hoy y abre una
                nueva. El histórico queda preservado.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
            <input
              type="radio"
              name="modo_visible"
              value="cerrar"
              checked={modo === "cerrar"}
              onChange={() => setModo("cerrar")}
              disabled={!vincActiva}
              className="mt-0.5 h-4 w-4 border-zelanda-beige-300 text-zelanda-verde-700"
            />
            <span className="text-sm">
              <span className="font-medium text-zelanda-verde-900">
                Cerrarla (sin abrir nueva)
              </span>
              <span className="mt-0.5 block text-xs text-zelanda-verde-700">
                Esta persona quedará sin vinculación activa. Útil cuando se va
                y no se sabe si vuelve.
              </span>
            </span>
          </label>
        </fieldset>

        {modo === "cambiar" ? (
          <div className="space-y-4 border-t border-zelanda-beige-200 pt-4">
            <div>
              <label htmlFor="nueva_tipo_vinculacion" className={labelBase}>
                Nuevo tipo
              </label>
              <select
                id="nueva_tipo_vinculacion"
                name="nueva_tipo_vinculacion"
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoVinculacion)}
                className={inputBase}
              >
                <option value="FIJO">Fijo</option>
                <option value="JORNALERO">Jornalero</option>
                <option value="CONTRATISTA">Contratista</option>
                <option value="FAMILIAR">Familia / propietario</option>
              </select>
            </div>
            <div>
              <label htmlFor="nueva_rol_finca" className={labelBase}>
                Rol en la finca
              </label>
              <input
                id="nueva_rol_finca"
                name="nueva_rol_finca"
                type="text"
                className={inputBase}
              />
            </div>
            {nuevoTipo === "FIJO" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nueva_salario_base" className={labelBase}>
                    Salario base
                  </label>
                  <input
                    id="nueva_salario_base"
                    name="nueva_salario_base"
                    type="number"
                    min="0"
                    step="1000"
                    required={nuevoTipo === "FIJO"}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="nueva_periodo_pago" className={labelBase}>
                    Período
                  </label>
                  <select
                    id="nueva_periodo_pago"
                    name="nueva_periodo_pago"
                    defaultValue="QUINCENAL"
                    required={nuevoTipo === "FIJO"}
                    className={inputBase}
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="QUINCENAL">Quincenal</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </div>
              </div>
            ) : null}
            {nuevoTipo === "JORNALERO" ? (
              <div>
                <label htmlFor="nueva_tarifa_jornal" className={labelBase}>
                  Tarifa por jornal
                </label>
                <input
                  id="nueva_tarifa_jornal"
                  name="nueva_tarifa_jornal"
                  type="number"
                  min="0"
                  step="1000"
                  required={nuevoTipo === "JORNALERO"}
                  className={inputBase}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {modo === "cerrar" ? (
          <p className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
            Al guardar, la vinculación activa quedará cerrada con la fecha de
            hoy y la persona aparecerá como &ldquo;Sin vinculación&rdquo; hasta que se
            le asigne una nueva.
          </p>
        ) : null}
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href={`/jefe/equipo/${persona.id}`}
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
