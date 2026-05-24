"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarPersonaYVinculacion, type EstadoEdicion } from "../acciones";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import type { TipoVinculacion } from "@/types";
import { formatearMiles, normalizarEntradaNumerica } from "@/lib/formatos";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";

const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type ModoVinculacion = "dejar" | "editar" | "cambiar" | "cerrar";

type Persona = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  notas: string | null;
};

type VinculacionActiva = {
  tipo: TipoVinculacion;
  rol_finca: string | null;
  salario_base: number | null;
  periodo_pago: string | null;
  tarifa_jornal: number | null;
  esquema_pago_destajo: string | null;
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
  const [nuevoSalario, setNuevoSalario] = useState("");
  const [nuevoTarifaJornal, setNuevoTarifaJornal] = useState("");
  const [editSalario, setEditSalario] = useState(
    vincActiva?.salario_base != null ? String(vincActiva.salario_base) : "",
  );
  const [editTarifaJornal, setEditTarifaJornal] = useState(
    vincActiva?.tarifa_jornal != null ? String(vincActiva.tarifa_jornal) : "",
  );

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
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {persona.nombre_completo}
        </h1>
      </header>

      {/* Datos */}
      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
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
          <label htmlFor="fecha_nacimiento" className={labelBase}>
            Fecha de nacimiento
          </label>
          <input
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            defaultValue={persona.fecha_nacimiento ?? ""}
            autoComplete="bday"
            className={inputBase}
          />
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
      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
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
              value="editar"
              checked={modo === "editar"}
              onChange={() => setModo("editar")}
              disabled={!vincActiva}
              className="mt-0.5 h-4 w-4 border-zelanda-beige-300 text-zelanda-verde-700"
            />
            <span className="text-sm">
              <span className="font-medium text-zelanda-verde-900">
                Editar la activa
              </span>
              <span className="mt-0.5 block text-xs text-zelanda-verde-700">
                Corrige rol, salario o tarifa sin tocar histórico. No cambia el
                tipo (para eso usa &ldquo;Cambiar a otro tipo&rdquo;).
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
                    type="text"
                    inputMode="numeric"
                    required={nuevoTipo === "FIJO"}
                    placeholder="Ej. 1.300.000"
                    value={formatearMiles(nuevoSalario)}
                    onChange={(e) =>
                      setNuevoSalario(normalizarEntradaNumerica(e.target.value))
                    }
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
                  type="text"
                  inputMode="numeric"
                  required={nuevoTipo === "JORNALERO"}
                  placeholder="Ej. 50.000"
                  value={formatearMiles(nuevoTarifaJornal)}
                  onChange={(e) =>
                    setNuevoTarifaJornal(normalizarEntradaNumerica(e.target.value))
                  }
                  className={inputBase}
                />
              </div>
            ) : null}
            {nuevoTipo === "FIJO" || nuevoTipo === "JORNALERO" ? (
              <div>
                <label htmlFor="nueva_esquema_pago_destajo" className={labelBase}>
                  Destajo (extras por kg / árbol)
                </label>
                <select
                  id="nueva_esquema_pago_destajo"
                  name="nueva_esquema_pago_destajo"
                  defaultValue="NUNCA"
                  className={inputBase}
                >
                  <option value="NUNCA">No cobra destajo</option>
                  <option value="ADICIONAL">Adicional al salario</option>
                  <option value="REEMPLAZA_DIA">
                    Reemplaza el día (cuando hace destajo)
                  </option>
                  <option value="SOLO_DESTAJO">Solo cobra destajo</option>
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {modo === "editar" && vincActiva ? (
          <div className="space-y-4 border-t border-zelanda-beige-200 pt-4">
            <div>
              <label htmlFor="edit_rol_finca" className={labelBase}>
                Rol en la finca
              </label>
              <input
                id="edit_rol_finca"
                name="edit_rol_finca"
                type="text"
                defaultValue={vincActiva.rol_finca ?? ""}
                className={inputBase}
              />
            </div>
            {vincActiva.tipo === "FIJO" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit_salario_base" className={labelBase}>
                    Salario base
                  </label>
                  <input
                    id="edit_salario_base"
                    name="edit_salario_base"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatearMiles(editSalario)}
                    onChange={(e) =>
                      setEditSalario(normalizarEntradaNumerica(e.target.value))
                    }
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="edit_periodo_pago" className={labelBase}>
                    Período
                  </label>
                  <select
                    id="edit_periodo_pago"
                    name="edit_periodo_pago"
                    required
                    defaultValue={vincActiva.periodo_pago ?? "QUINCENAL"}
                    className={inputBase}
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="QUINCENAL">Quincenal</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </div>
              </div>
            ) : null}
            {vincActiva.tipo === "JORNALERO" ? (
              <div>
                <label htmlFor="edit_tarifa_jornal" className={labelBase}>
                  Tarifa por jornal
                </label>
                <input
                  id="edit_tarifa_jornal"
                  name="edit_tarifa_jornal"
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatearMiles(editTarifaJornal)}
                  onChange={(e) =>
                    setEditTarifaJornal(normalizarEntradaNumerica(e.target.value))
                  }
                  className={inputBase}
                />
              </div>
            ) : null}
            {vincActiva.tipo === "FIJO" || vincActiva.tipo === "JORNALERO" ? (
              <div>
                <label htmlFor="edit_esquema_pago_destajo" className={labelBase}>
                  Destajo (extras por kg / árbol)
                </label>
                <select
                  id="edit_esquema_pago_destajo"
                  name="edit_esquema_pago_destajo"
                  defaultValue={vincActiva.esquema_pago_destajo ?? "NUNCA"}
                  className={inputBase}
                >
                  <option value="NUNCA">No cobra destajo</option>
                  <option value="ADICIONAL">Adicional al salario</option>
                  <option value="REEMPLAZA_DIA">
                    Reemplaza el día (cuando hace destajo)
                  </option>
                  <option value="SOLO_DESTAJO">Solo cobra destajo</option>
                </select>
              </div>
            ) : null}
            {vincActiva.tipo === "CONTRATISTA" || vincActiva.tipo === "FAMILIAR" ? (
              <p className="text-xs text-zelanda-verde-700">
                Este tipo de vinculación no tiene salario ni tarifa configurable.
                Solo puedes actualizar el rol en la finca.
              </p>
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
          className="flex-1 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
