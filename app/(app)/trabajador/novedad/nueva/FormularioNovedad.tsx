"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CloudOff } from "lucide-react";
import { SubirFoto } from "@/components/shared/SubirFoto";
import { enviarNovedad } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400";
const labelBase = "block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700";

type Lote = { id: string; nombre: string; totalArboles: number };

export function FormularioNovedad({
  lotes,
  loteInicial,
  numeroInicial,
}: {
  lotes: Lote[];
  loteInicial?: string | null;
  numeroInicial?: string | null;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [loteId, setLoteId] = useState<string>(loteInicial ?? "");
  const loteSeleccionado = lotes.find((l) => l.id === loteId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const lote = String(formData.get("lote_id") ?? "");
    const placa = parseInt(String(formData.get("numero_placa") ?? ""), 10);
    const tipo = String(formData.get("tipo") ?? "") as
      | "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO";
    const descripcion = String(formData.get("descripcion") ?? "").trim();

    if (!lote || !/^\d+$/.test(lote)) {
      setError("Selecciona un lote.");
      return;
    }
    if (!Number.isInteger(placa) || placa < 1) {
      setError("Número de árbol inválido.");
      return;
    }
    if (!tipo) {
      setError("Selecciona tipo de novedad.");
      return;
    }
    if (!descripcion) {
      setError("Descripción obligatoria.");
      return;
    }

    const foto = formData.get("foto");
    const hayFoto = foto instanceof File && foto.size > 0;

    if (hayFoto && online) {
      // Path con foto: POST multipart directo (sin cola; requiere señal)
      startTransition(async () => {
        try {
          const res = await fetch("/api/trabajador/novedad-con-foto", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}) as { error?: string });
            setError(j.error ?? "No se pudo reportar la novedad.");
            return;
          }
          router.push("/trabajador");
        } catch {
          setError("No se pudo enviar. Revisá la conexión.");
        }
      });
      return;
    }

    startTransition(async () => {
      const r = await enviarNovedad({
        lote_id: lote,
        numero_placa: placa,
        tipo,
        descripcion,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/trabajador");
    });
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
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">Reportar</p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Nueva novedad</h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
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
              <option key={l.id} value={l.id}>
                {l.nombre} ({l.totalArboles} árboles)
              </option>
            ))}
          </select>
          {lotes.length === 0 ? (
            <p className="mt-1 text-xs text-zelanda-ocre-600">
              No hay lotes con árboles cargados. Pídele al jefe que cargue árboles antes de reportar novedades.
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="numero_placa" className={labelBase}>Número de árbol</label>
            {loteSeleccionado && numeroInicial ? (
              <Link
                href={`/trabajador/arbol/${loteSeleccionado.id}/${numeroInicial}`}
                className="text-xs text-zelanda-verde-700 underline hover:text-zelanda-verde-900"
              >
                Ver historial →
              </Link>
            ) : null}
          </div>
          <input
            id="numero_placa"
            name="numero_placa"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min="1"
            max={loteSeleccionado?.totalArboles ?? undefined}
            required
            disabled={!loteSeleccionado}
            defaultValue={numeroInicial ?? ""}
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

        {online ? (
          <div>
            <label className={labelBase}>Foto (opcional)</label>
            <div className="mt-1.5">
              <SubirFoto name="foto" />
            </div>
            <p className="mt-1 text-xs text-zelanda-verde-700/70">
              La foto se subirá ahora si hay señal.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-zelanda-beige-300 bg-zelanda-beige-50 px-3 py-2 text-xs text-zelanda-verde-700">
            Sin señal — la foto solo se puede adjuntar con conexión. Podés reportar la novedad ahora; la foto la sumás después si la necesitás.
          </p>
        )}
      </section>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la novedad se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/trabajador"
          className="flex-1 rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 text-center font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente || lotes.length === 0}
          className="flex-1 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Reportando…" : "Reportar"}
        </button>
      </div>
    </form>
  );
}
