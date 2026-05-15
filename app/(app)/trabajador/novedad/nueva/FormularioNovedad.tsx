"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearNovedad, type EstadoNovedad } from "./acciones";
import { SubirFoto } from "@/components/shared/SubirFoto";

const ESTADO_INICIAL: EstadoNovedad = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Lote = { id: string; nombre: string; totalArboles: number };

export function FormularioNovedad({ lotes }: { lotes: Lote[] }) {
  const [estado, accion, pendiente] = useActionState(crearNovedad, ESTADO_INICIAL);
  const [loteId, setLoteId] = useState<string>("");
  const loteSeleccionado = lotes.find((l) => l.id === loteId);

  return (
    <form action={accion} className="space-y-6" noValidate encType="multipart/form-data">
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reportar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva novedad
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div>
          <label htmlFor="lote_id" className={labelBase}>Lote</label>
          <select
            id="lote_id"
            name="lote_id"
            required
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className={inputBase}
          >
            <option value="">Selecciona…</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre} ({l.totalArboles} árboles)</option>
            ))}
          </select>
          {lotes.length === 0 ? (
            <p className="mt-1 text-xs text-zelanda-ocre-600">
              No hay lotes con árboles cargados. Pídele al jefe que cargue árboles antes de reportar novedades.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="numero_placa" className={labelBase}>Número de árbol</label>
          <input
            id="numero_placa"
            name="numero_placa"
            type="number"
            min="1"
            max={loteSeleccionado?.totalArboles ?? undefined}
            required
            disabled={!loteSeleccionado}
            className={inputBase}
            placeholder={loteSeleccionado ? `1 a ${loteSeleccionado.totalArboles}` : "Elige lote primero"}
          />
        </div>

        <div>
          <label htmlFor="tipo" className={labelBase}>Tipo de novedad</label>
          <select id="tipo" name="tipo" required defaultValue="" className={inputBase}>
            <option value="">Selecciona…</option>
            <option value="PLAGA">Plaga</option>
            <option value="DANO_FISICO">Daño físico</option>
            <option value="ENFERMEDAD">Enfermedad</option>
            <option value="OBSERVACION">Observación</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            required
            className={`${inputBase} min-h-[80px] resize-y`}
            placeholder="Describe qué viste en el árbol"
          />
        </div>

        <div>
          <label className={labelBase}>Foto (opcional)</label>
          <div className="mt-1.5">
            <SubirFoto name="foto" />
          </div>
        </div>
      </section>

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
          disabled={pendiente || lotes.length === 0}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Reportando…" : "Reportar"}
        </button>
      </div>
    </form>
  );
}
