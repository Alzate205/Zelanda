"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Sprout,
  Map as MapIcon,
  User as UserIcon,
  Wrench,
  FlaskConical,
} from "lucide-react";

type ResultadoArbol = {
  lote_id: string;
  lote_nombre: string;
  numero: number;
};

type Respuesta = {
  vacio?: boolean;
  arbol: ResultadoArbol | null;
  lotes: { id: string; nombre: string }[];
  personas: { id: string; nombre_completo: string; cedula: string | null }[];
  herramientas: { id: string; nombre: string; categoria: string }[];
  insumos: { id: string; nombre: string; categoria: string; unidad: string }[];
};

const VACIO: Respuesta = {
  vacio: true,
  arbol: null,
  lotes: [],
  personas: [],
  herramientas: [],
  insumos: [],
};

export function BuscadorGlobal() {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"inicial" | "cargando" | "ok" | "error">(
    "inicial",
  );
  const [data, setData] = useState<Respuesta>(VACIO);
  const inputRef = useRef<HTMLInputElement>(null);

  function abrir() {
    setAbierto(true);
    setQ("");
    setData(VACIO);
    setEstado("inicial");
  }

  function cerrar() {
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const query = q.trim();
    if (query.length < 2) {
      setData(VACIO);
      setEstado("inicial");
      return;
    }
    const controller = new AbortController();
    setEstado("cargando");
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/jefe/buscar?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setEstado("error");
          return;
        }
        const json = (await res.json()) as Respuesta;
        setData(json);
        setEstado("ok");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setEstado("error");
      }
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [q, abierto]);

  const hayResultados =
    !data.vacio &&
    (data.arbol !== null ||
      data.lotes.length > 0 ||
      data.personas.length > 0 ||
      data.herramientas.length > 0 ||
      data.insumos.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar"
        className="flex min-h-touch min-w-touch items-center justify-center rounded-lg p-2 text-zelanda-beige-100 transition hover:bg-white/10"
      >
        <Search className="h-5 w-5" />
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-xl sm:shadow-card">
            <div className="flex items-center gap-2 border-b border-zelanda-beige-200 p-3">
              <Search className="h-5 w-5 text-zelanda-verde-700/60" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, cédula, o 'Salento 100'"
                className="flex-1 bg-transparent text-base text-zelanda-verde-900 outline-none placeholder:text-zelanda-verde-700/50"
              />
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-zelanda-verde-700 transition hover:bg-zelanda-beige-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {estado === "inicial" ? (
                <p className="px-2 py-4 text-sm text-zelanda-verde-700/70">
                  Escribí un nombre, cédula o número (2+ caracteres).
                </p>
              ) : null}

              {estado === "cargando" ? (
                <p className="px-2 py-4 text-sm text-zelanda-verde-700/70">
                  Buscando…
                </p>
              ) : null}

              {estado === "error" ? (
                <p className="px-2 py-4 text-sm text-estado-vencida">
                  No se pudo buscar, intenta de nuevo.
                </p>
              ) : null}

              {estado === "ok" && !hayResultados ? (
                <p className="px-2 py-4 text-sm text-zelanda-verde-700/70">
                  Sin coincidencias.
                </p>
              ) : null}

              {estado === "ok" && hayResultados ? (
                <div className="space-y-4">
                  {data.arbol ? (
                    <Link
                      href={`/jefe/lotes/${data.arbol.lote_id}/arbol/${data.arbol.numero}`}
                      onClick={cerrar}
                      className="flex items-center gap-3 rounded-lg border border-zelanda-verde-300 bg-zelanda-verde-50 p-3 transition hover:bg-zelanda-verde-100"
                    >
                      <Sprout className="h-5 w-5 text-zelanda-verde-700" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zelanda-verde-900">
                          Árbol #{data.arbol.numero}
                        </p>
                        <p className="text-xs text-zelanda-verde-700">
                          en {data.arbol.lote_nombre}
                        </p>
                      </div>
                    </Link>
                  ) : null}

                  {data.lotes.length > 0 ? (
                    <Seccion icono={<MapIcon className="h-4 w-4" />} titulo="Lotes">
                      {data.lotes.map((l) => (
                        <Link
                          key={l.id}
                          href={`/jefe/lotes/${l.id}`}
                          onClick={cerrar}
                          className="block rounded-lg px-3 py-2 text-sm text-zelanda-verde-900 transition hover:bg-zelanda-beige-100"
                        >
                          {l.nombre}
                        </Link>
                      ))}
                    </Seccion>
                  ) : null}

                  {data.personas.length > 0 ? (
                    <Seccion icono={<UserIcon className="h-4 w-4" />} titulo="Personas">
                      {data.personas.map((p) => (
                        <Link
                          key={p.id}
                          href={`/jefe/equipo/${p.id}`}
                          onClick={cerrar}
                          className="block rounded-lg px-3 py-2 text-sm transition hover:bg-zelanda-beige-100"
                        >
                          <p className="text-zelanda-verde-900">{p.nombre_completo}</p>
                          {p.cedula ? (
                            <p className="text-xs text-zelanda-verde-700/70">
                              CC {p.cedula}
                            </p>
                          ) : null}
                        </Link>
                      ))}
                    </Seccion>
                  ) : null}

                  {data.herramientas.length > 0 ? (
                    <Seccion icono={<Wrench className="h-4 w-4" />} titulo="Herramientas">
                      {data.herramientas.map((h) => (
                        <Link
                          key={h.id}
                          href={`/bodega/inventario/herramientas/${h.id}/editar`}
                          onClick={cerrar}
                          className="block rounded-lg px-3 py-2 text-sm transition hover:bg-zelanda-beige-100"
                        >
                          <p className="text-zelanda-verde-900">{h.nombre}</p>
                          <p className="text-xs text-zelanda-verde-700/70">
                            {h.categoria}
                          </p>
                        </Link>
                      ))}
                    </Seccion>
                  ) : null}

                  {data.insumos.length > 0 ? (
                    <Seccion icono={<FlaskConical className="h-4 w-4" />} titulo="Insumos">
                      {data.insumos.map((i) => (
                        <Link
                          key={i.id}
                          href={`/bodega/inventario/insumos/${i.id}/historial`}
                          onClick={cerrar}
                          className="block rounded-lg px-3 py-2 text-sm transition hover:bg-zelanda-beige-100"
                        >
                          <p className="text-zelanda-verde-900">{i.nombre}</p>
                          <p className="text-xs text-zelanda-verde-700/70">
                            {i.categoria} · {i.unidad}
                          </p>
                        </Link>
                      ))}
                    </Seccion>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Seccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 px-2 text-xs uppercase tracking-wider text-zelanda-verde-700">
        {icono}
        {titulo}
      </h3>
      <div className="mt-1 divide-y divide-zelanda-beige-200">{children}</div>
    </section>
  );
}
