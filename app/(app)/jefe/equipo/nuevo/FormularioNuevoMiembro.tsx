"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearMiembro, type EstadoFormulario } from "../acciones";

const ESTADO_INICIAL: EstadoFormulario = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

const ROLES_FINCA_SUGERIDOS = [
  "Jefe de finca",
  "Bodeguero",
  "Almacenista",
  "Recolector",
  "Trabajador de campo",
];

export function FormularioNuevoMiembro() {
  const [estado, accion, pendiente] = useActionState(crearMiembro, ESTADO_INICIAL);
  const [tipoVinculacion, setTipoVinculacion] = useState<
    "FIJO" | "JORNALERO" | "CONTRATISTA" | "FAMILIAR"
  >("FIJO");
  const [crearAcceso, setCrearAcceso] = useState(true);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/equipo"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Equipo
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Nuevo miembro
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Agregar al equipo
        </h1>
      </header>

      {/* Sección 1: Datos de la persona */}
      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos de la persona
        </h2>

        <div>
          <label htmlFor="nombre_completo" className={labelBase}>
            Nombre completo <span className="text-estado-vencida">*</span>
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cedula" className={labelBase}>
              Cédula
            </label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelBase}>
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
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
            autoComplete="bday"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            placeholder="Observaciones internas (opcional)."
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>
      </section>

      {/* Sección 2: Vinculación con la finca */}
      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación con la finca
        </h2>

        <div>
          <label htmlFor="tipo_vinculacion" className={labelBase}>
            Tipo <span className="text-estado-vencida">*</span>
          </label>
          <select
            id="tipo_vinculacion"
            name="tipo_vinculacion"
            required
            value={tipoVinculacion}
            onChange={(e) =>
              setTipoVinculacion(
                e.target.value as "FIJO" | "JORNALERO" | "CONTRATISTA" | "FAMILIAR",
              )
            }
            className={inputBase}
          >
            <option value="FIJO">Fijo (sueldo periódico)</option>
            <option value="JORNALERO">Jornalero (por días)</option>
            <option value="CONTRATISTA">Contratista (por servicio)</option>
            <option value="FAMILIAR">Familia / propietario</option>
          </select>
        </div>

        <div>
          <label htmlFor="rol_finca" className={labelBase}>
            Rol en la finca
          </label>
          <input
            id="rol_finca"
            name="rol_finca"
            type="text"
            list="roles-finca-sugeridos"
            placeholder="Ej. Recolector, Bodeguero, Apicultor"
            className={inputBase}
          />
          <datalist id="roles-finca-sugeridos">
            {ROLES_FINCA_SUGERIDOS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <p className="mt-1.5 text-xs text-zelanda-verde-700">
            Texto libre; distinto al rol del sistema.
          </p>
        </div>

        {tipoVinculacion === "FIJO" ? (
          <div className="grid grid-cols-1 gap-4 border-t border-zelanda-beige-200 pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="salario_base" className={labelBase}>
                Salario base <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="salario_base"
                name="salario_base"
                type="number"
                inputMode="numeric"
                min="0"
                step="1000"
                required
                placeholder="Ej. 1300000"
                className={inputBase}
              />
            </div>
            <div>
              <label htmlFor="periodo_pago" className={labelBase}>
                Período <span className="text-estado-vencida">*</span>
              </label>
              <select
                id="periodo_pago"
                name="periodo_pago"
                required
                defaultValue="QUINCENAL"
                className={inputBase}
              >
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="SEMANAL">Semanal</option>
              </select>
            </div>
          </div>
        ) : null}

        {tipoVinculacion === "JORNALERO" ? (
          <div className="border-t border-zelanda-beige-200 pt-4">
            <label htmlFor="tarifa_jornal" className={labelBase}>
              Tarifa por jornal <span className="text-estado-vencida">*</span>
            </label>
            <input
              id="tarifa_jornal"
              name="tarifa_jornal"
              type="number"
              inputMode="numeric"
              min="0"
              step="1000"
              required
              placeholder="Ej. 50000"
              className={inputBase}
            />
            <p className="mt-1.5 text-xs text-zelanda-verde-700">
              Tarifa default que cobra por día. Se puede ajustar por jornada
              cuando se implemente la capa financiera.
            </p>
          </div>
        ) : null}
      </section>

      {/* Sección 3: Acceso al sistema */}
      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Acceso al sistema
        </h2>

        <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="crear_acceso"
            checked={crearAcceso}
            onChange={(e) => setCrearAcceso(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700 focus:ring-zelanda-verde-600/20"
          />
          <span className="text-sm">
            <span className="font-medium text-zelanda-verde-900">
              Crear cuenta para entrar a la app
            </span>
            <span className="mt-0.5 block text-xs text-zelanda-verde-700">
              Si la persona no usará la app (contratista de un servicio puntual,
              jornalero ocasional, familia que ya tiene acceso), déjalo sin marcar.
            </span>
          </span>
        </label>

        {crearAcceso ? (
          <div className="space-y-4 border-t border-zelanda-beige-200 pt-4">
            <div>
              <label htmlFor="email" className={labelBase}>
                Correo <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required={crearAcceso}
                className={inputBase}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelBase}>
                Contraseña <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={crearAcceso}
                minLength={8}
                className={inputBase}
              />
              <p className="mt-1.5 text-xs text-zelanda-verde-700">
                Mínimo 8 caracteres. Compártela por canal seguro.
              </p>
            </div>

            <div>
              <label htmlFor="rol_app" className={labelBase}>
                Rol en la app <span className="text-estado-vencida">*</span>
              </label>
              <select
                id="rol_app"
                name="rol_app"
                required={crearAcceso}
                defaultValue="TRABAJADOR"
                className={inputBase}
              >
                <option value="TRABAJADOR">Trabajador</option>
                <option value="BODEGA">Bodega</option>
                <option value="ALMACEN">Almacén</option>
                <option value="JEFE">Jefe</option>
              </select>
            </div>
          </div>
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
          href="/jefe/equipo"
          className="flex-1 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Crear miembro"}
        </button>
      </div>
    </form>
  );
}
