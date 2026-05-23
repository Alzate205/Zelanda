"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  CloudOff,
  Wrench,
  FlaskConical,
  Plus,
} from "lucide-react";
import { Stepper } from "@/components/ui/Stepper";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { enviarDespachoCrear } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type Persona = { id: string; nombre: string };

type Categoria = "CULTIVO" | "COSECHA" | "APICULTURA";

type Herramienta = {
  id: string;
  nombre: string;
  categoria: Categoria;
  disponible: number;
};

type Insumo = {
  id: string;
  nombre: string;
  categoria: Categoria;
  unidad: string;
  disponible: number;
};

type Asignacion = {
  id: string;
  persona_id: string;
  etiqueta: string;
};

const ETIQUETA_CAT: Record<Categoria, string> = {
  CULTIVO: "cultivo",
  COSECHA: "cosecha",
  APICULTURA: "apicultura",
};

export function WizardNuevoDespacho({
  personas,
  herramientas,
  insumos,
  asignaciones,
}: {
  personas: Persona[];
  herramientas: Herramienta[];
  insumos: Insumo[];
  asignaciones: Asignacion[];
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [paso, setPaso] = useState(1);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [asignacionId, setAsignacionId] = useState<string | null>(null);
  const [herr, setHerr] = useState<Record<string, number>>({});
  const [ins, setIns] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState("");

  const personaSel = personaId
    ? personas.find((p) => p.id === personaId) ?? null
    : null;

  const asignacionesFiltradas = useMemo(
    () => asignaciones.filter((a) => a.persona_id === personaId),
    [asignaciones, personaId],
  );

  const totalHerr = Object.values(herr).reduce((a, b) => a + b, 0);
  const totalIns = Object.values(ins).reduce((a, b) => a + b, 0);
  const totalItems = totalHerr + totalIns;

  function setQ(
    id: string,
    cantidad: number,
    target: "herr" | "ins",
  ) {
    const setter = target === "herr" ? setHerr : setIns;
    setter((prev) => {
      const next = { ...prev };
      if (cantidad <= 0) delete next[id];
      else next[id] = cantidad;
      return next;
    });
  }

  function avanzar() {
    setError(null);
    if (paso === 1) {
      if (!personaId) {
        setError("Selecciona un trabajador.");
        return;
      }
      setPaso(2);
      return;
    }
    if (paso === 2) {
      if (totalItems === 0) {
        setError("Agrega al menos un item al despacho.");
        return;
      }
      setPaso(3);
      return;
    }
  }

  function retroceder() {
    setError(null);
    if (paso === 1) {
      router.push("/bodega/despachos");
      return;
    }
    setPaso(paso - 1);
  }

  function enviar() {
    setError(null);
    if (!personaId) return;
    if (totalItems === 0) return;

    const items: Array<{
      tipo: "HERRAMIENTA" | "INSUMO";
      ref_id: string;
      cantidad: number;
    }> = [];

    for (const [id, q] of Object.entries(herr)) {
      if (q > 0) items.push({ tipo: "HERRAMIENTA", ref_id: id, cantidad: q });
    }
    for (const [id, q] of Object.entries(ins)) {
      if (q > 0) items.push({ tipo: "INSUMO", ref_id: id, cantidad: q });
    }

    startTransition(async () => {
      const r = await enviarDespachoCrear({
        persona_id: personaId,
        asignacion_id: asignacionId,
        items,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/bodega/despachos");
    });
  }

  const tituloPorPaso = [
    "",
    "¿Para quién?",
    "Herramientas e insumos",
    "Confirmar despacho",
  ];

  return (
    <div className="-mx-4 -mt-4 flex min-h-svh flex-col">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-3 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={retroceder}
            aria-label={paso === 1 ? "Cancelar" : "Atrás"}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Nuevo despacho · paso {paso} de 3
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[20px] font-medium leading-tight">
              {tituloPorPaso[paso]}
            </h1>
          </div>
        </div>
        <Stepper pasos={3} actual={paso} className="mt-3" />
      </div>

      <div className="flex-1 px-4 pb-[88px] pt-4">
        {paso === 1 ? (
          <Paso1
            personas={personas}
            personaId={personaId}
            setPersonaId={(id) => {
              setPersonaId(id);
              setAsignacionId(null);
            }}
          />
        ) : null}
        {paso === 2 ? (
          <Paso2
            personaSel={personaSel}
            herramientas={herramientas}
            insumos={insumos}
            asignaciones={asignacionesFiltradas}
            asignacionId={asignacionId}
            setAsignacionId={setAsignacionId}
            herr={herr}
            ins={ins}
            setQ={setQ}
          />
        ) : null}
        {paso === 3 ? (
          <Paso3
            personaSel={personaSel}
            herramientas={herramientas}
            insumos={insumos}
            asignaciones={asignacionesFiltradas}
            asignacionId={asignacionId}
            herr={herr}
            ins={ins}
            notas={notas}
            setNotas={setNotas}
          />
        ) : null}

        {!online ? (
          <p className="mt-3 flex items-center gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
            <CloudOff className="h-3.5 w-3.5" />
            Sin señal — el despacho se guardará y subirá al volver la conexión.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-[10px] border border-estado-vencida/30 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <button
            type="button"
            onClick={retroceder}
            disabled={pendiente}
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200 disabled:opacity-60"
          >
            {paso === 1 ? "Cancelar" : "Atrás"}
          </button>
          {paso < 3 ? (
            <button
              type="button"
              onClick={avanzar}
              disabled={paso === 2 && totalItems === 0}
              className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={pendiente}
              className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              <Check className="h-[18px] w-[18px]" />
              {pendiente ? "Despachando…" : "Crear despacho"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Paso1({
  personas,
  personaId,
  setPersonaId,
}: {
  personas: Persona[];
  personaId: string | null;
  setPersonaId: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [busqueda, personas]);

  return (
    <div>
      <p className="m-0 mb-3 text-[12.5px] text-zelanda-verde-700">
        Elegí el trabajador para este despacho.
      </p>
      <div className="relative mb-3">
        <input
          className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white pl-9 pr-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          placeholder="Buscar persona…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zelanda-verde-400" />
      </div>
      <div className="flex flex-col gap-1.5">
        {filtradas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            No hay personas que coincidan.
          </p>
        ) : (
          filtradas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersonaId(p.id)}
              className={`flex min-h-[60px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-suave transition ${
                p.id === personaId
                  ? "border-2 border-zelanda-verde-700 bg-zelanda-verde-50"
                  : "border border-zelanda-beige-200 bg-white hover:border-zelanda-verde-300"
              }`}
            >
              <AvatarIniciales id={p.id} nombre={p.nombre} tamano="md" />
              <p className="m-0 flex-1 font-serif text-[15px] text-zelanda-verde-900">
                {p.nombre}
              </p>
              {p.id === personaId ? (
                <Check
                  className="h-[18px] w-[18px] text-zelanda-verde-700"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Paso2({
  personaSel,
  herramientas,
  insumos,
  asignaciones,
  asignacionId,
  setAsignacionId,
  herr,
  ins,
  setQ,
}: {
  personaSel: Persona | null;
  herramientas: Herramienta[];
  insumos: Insumo[];
  asignaciones: Asignacion[];
  asignacionId: string | null;
  setAsignacionId: (id: string | null) => void;
  herr: Record<string, number>;
  ins: Record<string, number>;
  setQ: (id: string, cantidad: number, target: "herr" | "ins") => void;
}) {
  const insumosDisponibles = insumos.filter((i) => i.disponible > 0);

  return (
    <div>
      <p className="m-0 mb-3 text-[12.5px] text-zelanda-verde-700">
        Despachando para{" "}
        <strong className="font-serif text-zelanda-verde-900">
          {personaSel?.nombre ?? "—"}
        </strong>
        .
      </p>

      {asignaciones.length > 0 ? (
        <div className="mb-4">
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
            Asignación (opcional)
          </label>
          <select
            value={asignacionId ?? ""}
            onChange={(e) => setAsignacionId(e.target.value || null)}
            className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          >
            <option value="">Sin asignación vinculada</option>
            {asignaciones.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
        Herramientas
      </p>
      <div className="mb-4 flex flex-col gap-1.5">
        {herramientas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-4 text-center text-xs text-zelanda-verde-700">
            No hay herramientas en catálogo.
          </p>
        ) : (
          herramientas.map((h) => (
            <FilaCantidad
              key={h.id}
              nombre={h.nombre}
              detalle={`${h.disponible} ${h.disponible === 1 ? "disponible" : "disponibles"} · ${ETIQUETA_CAT[h.categoria]}`}
              cantidad={herr[h.id] ?? 0}
              maximo={h.disponible}
              onChange={(q) => setQ(h.id, q, "herr")}
              icono={Wrench}
            />
          ))
        )}
      </div>

      <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
        Insumos
      </p>
      <div className="flex flex-col gap-1.5">
        {insumosDisponibles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-4 text-center text-xs text-zelanda-verde-700">
            No hay insumos con stock disponible.
          </p>
        ) : (
          insumosDisponibles.map((i) => (
            <FilaCantidad
              key={i.id}
              nombre={i.nombre}
              detalle={`${i.disponible.toLocaleString("es-CO")} ${i.unidad} en stock · ${ETIQUETA_CAT[i.categoria]}`}
              unidad={i.unidad}
              cantidad={ins[i.id] ?? 0}
              maximo={i.disponible}
              paso={
                i.unidad.toLowerCase().includes("kg") ||
                i.unidad.toLowerCase() === "l"
                  ? 0.5
                  : 1
              }
              onChange={(q) => setQ(i.id, q, "ins")}
              icono={FlaskConical}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilaCantidad({
  nombre,
  detalle,
  cantidad,
  maximo,
  onChange,
  icono: Icono,
  unidad,
  paso = 1,
}: {
  nombre: string;
  detalle: string;
  cantidad: number;
  maximo: number;
  onChange: (q: number) => void;
  icono: React.ComponentType<{ className?: string }>;
  unidad?: string;
  paso?: number;
}) {
  const activo = cantidad > 0;
  const fmtCantidad = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  function inc(delta: number) {
    const nuevo = Math.max(0, Math.min(maximo, cantidad + delta));
    onChange(Math.round(nuevo * 1000) / 1000);
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 ${
        activo
          ? "border-[1.5px] border-zelanda-verde-400 bg-zelanda-verde-50"
          : "border border-zelanda-beige-200 bg-white"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-zelanda-beige-100 text-zelanda-verde-700">
        <Icono className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[14px] text-zelanda-verde-900">
          {nombre}
        </p>
        <p className="m-0 mt-0.5 text-[10.5px] text-zelanda-verde-700">
          {detalle}
        </p>
      </div>
      {cantidad === 0 ? (
        <button
          type="button"
          onClick={() => inc(paso)}
          className="flex h-[34px] items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-2.5 text-[12.5px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      ) : (
        <div className="flex items-center overflow-hidden rounded-[8px] border border-zelanda-verde-300 bg-white">
          <button
            type="button"
            onClick={() => inc(-paso)}
            className="flex h-[34px] w-[30px] items-center justify-center text-[18px] text-zelanda-verde-800 hover:bg-zelanda-beige-50"
            aria-label="Restar"
          >
            −
          </button>
          <span className="min-w-[36px] text-center font-serif text-[15px] text-zelanda-verde-900">
            {fmtCantidad(cantidad)}
            {unidad ? ` ${unidad}` : ""}
          </span>
          <button
            type="button"
            onClick={() => inc(paso)}
            className="flex h-[34px] w-[30px] items-center justify-center text-[18px] text-zelanda-verde-800 hover:bg-zelanda-beige-50"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function Paso3({
  personaSel,
  herramientas,
  insumos,
  asignaciones,
  asignacionId,
  herr,
  ins,
  notas,
  setNotas,
}: {
  personaSel: Persona | null;
  herramientas: Herramienta[];
  insumos: Insumo[];
  asignaciones: Asignacion[];
  asignacionId: string | null;
  herr: Record<string, number>;
  ins: Record<string, number>;
  notas: string;
  setNotas: (n: string) => void;
}) {
  const herrItems = Object.entries(herr)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({
      id,
      cantidad: q,
      nombre: herramientas.find((h) => h.id === id)?.nombre ?? "?",
    }));
  const insItems = Object.entries(ins)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({
      id,
      cantidad: q,
      nombre: insumos.find((x) => x.id === id)?.nombre ?? "?",
      unidad: insumos.find((x) => x.id === id)?.unidad ?? "",
    }));
  const asignSel =
    asignacionId !== null
      ? asignaciones.find((a) => a.id === asignacionId) ?? null
      : null;

  if (!personaSel) {
    return (
      <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
        Faltan datos para confirmar.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-zelanda-verde-300 bg-white shadow-card">
        <div className="flex items-center gap-2.5 bg-gradient-to-br from-zelanda-verde-700 to-zelanda-verde-800 px-3.5 py-3 text-zelanda-beige-50">
          <AvatarIniciales
            id={personaSel.id}
            nombre={personaSel.nombre}
            tamano="md"
          />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Despacho para
            </p>
            <h2 className="m-0 mt-0.5 font-serif text-[18px] font-medium leading-tight">
              {personaSel.nombre}
            </h2>
            {asignSel ? (
              <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-beige-100/85">
                {asignSel.etiqueta}
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-3.5 py-3">
          {herrItems.length > 0 ? (
            <>
              <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                Herramientas ({herrItems.length})
              </p>
              <ul className="mb-3 space-y-1">
                {herrItems.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="flex items-center gap-2 text-zelanda-verde-900">
                      <Wrench className="h-3.5 w-3.5 text-zelanda-verde-700" />
                      {it.nombre}
                    </span>
                    <span className="font-serif text-[14px] text-zelanda-verde-900">
                      ×{it.cantidad}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {insItems.length > 0 ? (
            <>
              <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                Insumos ({insItems.length})
              </p>
              <ul className="space-y-1">
                {insItems.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="flex items-center gap-2 text-zelanda-verde-900">
                      <FlaskConical className="h-3.5 w-3.5 text-zelanda-ocre-600" />
                      {it.nombre}
                    </span>
                    <span className="font-serif text-[14px] text-zelanda-verde-900">
                      {Number.isInteger(it.cantidad)
                        ? it.cantidad
                        : it.cantidad.toFixed(1)}{" "}
                      <span className="text-[11px] text-zelanda-verde-700">
                        {it.unidad}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
          Notas (opcional)
        </label>
        <textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Detalles del despacho…"
          className="block w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2.5 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>
    </div>
  );
}
