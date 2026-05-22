# Búsqueda global para el jefe — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un buscador global accesible desde el header (solo rol JEFE) que encuentra árbol, lote, persona, herramienta o insumo desde cualquier pantalla.

**Architecture:** API route `GET /api/jefe/buscar?q=...` con queries paralelas + parsing de sintaxis "lote N" para resultado de árbol directo. Cliente `BuscadorGlobal` (client component) integrado en `HeaderApp`, condicional al rol. Modal fullscreen-mobile con input debounceado + lista agrupada por categoría.

**Tech Stack:** Next.js 15.5 App Router, React 19 (useState/useEffect/useRef), Prisma 6.19, Tailwind, TypeScript. Sin migración SQL.

**Spec:** [`docs/superpowers/specs/2026-05-22-busqueda-global-jefe-design.md`](../specs/2026-05-22-busqueda-global-jefe-design.md)

---

## Convenciones de este plan

- Patrón de API route: `obtenerUsuarioActual()` + check de rol, devuelve `NextResponse.json(...)`. Referencia: `app/api/jefe/snapshot/route.ts`.
- Patrón de Prisma con texto: `mode: "insensitive"` para case-insensitive en `contains` y `equals`.
- Sin tests automatizados — verificación manual final.
- Commits en español, prefijo `feat:`.
- Trabajar en `main` directamente.

## Archivos involucrados

```
components/shared/
├── HeaderApp.tsx                       [MODIFICAR — Tarea 3]
└── BuscadorGlobal.tsx                  [NUEVO — Tarea 2]

app/api/jefe/buscar/
└── route.ts                            [NUEVO — Tarea 1]
```

---

## Tarea 1: API route `/api/jefe/buscar`

**Files:**
- Create: `app/api/jefe/buscar/route.ts`

Endpoint que ejecuta las 4 queries (lotes/personas/herramientas/insumos) en paralelo y agrega el parsing de sintaxis "lote N" para devolver árbol específico.

- [ ] **Step 1: Crear archivo `app/api/jefe/buscar/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

async function buscarArbolParseado(q: string): Promise<ResultadoArbol | null> {
  const trimmed = q.trim();
  const candidatos: { nombre: string; numero: number }[] = [];

  const m1 = trimmed.match(/^(\d+)\s+(.+)$/);
  if (m1) {
    candidatos.push({ nombre: m1[2].trim(), numero: parseInt(m1[1], 10) });
  }
  const m2 = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (m2) {
    candidatos.push({ nombre: m2[1].trim(), numero: parseInt(m2[2], 10) });
  }

  for (const c of candidatos) {
    if (c.numero < 1) continue;
    const lote = await prisma.lotes.findFirst({
      where: {
        deleted_at: null,
        nombre: { equals: c.nombre, mode: "insensitive" },
      },
      select: { id: true, nombre: true, total_arboles: true },
    });
    if (lote && c.numero >= 1 && c.numero <= lote.total_arboles) {
      return {
        lote_id: String(lote.id),
        lote_nombre: lote.nombre,
        numero: c.numero,
      };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "JEFE") {
    return NextResponse.json(
      { error: "Solo el rol JEFE puede usar la búsqueda global." },
      { status: 403 },
    );
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    const vacio: Respuesta = {
      vacio: true,
      arbol: null,
      lotes: [],
      personas: [],
      herramientas: [],
      insumos: [],
    };
    return NextResponse.json(vacio, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const [arbol, lotes, personas, herramientas, insumos] = await Promise.all([
      buscarArbolParseado(q),
      prisma.lotes.findMany({
        where: {
          deleted_at: null,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true },
      }),
      prisma.personas.findMany({
        where: {
          deleted_at: null,
          OR: [
            { nombre_completo: { contains: q, mode: "insensitive" } },
            { cedula: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { nombre_completo: "asc" },
        take: 5,
        select: { id: true, nombre_completo: true, cedula: true },
      }),
      prisma.herramientas.findMany({
        where: {
          activo: true,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true, categoria: true },
      }),
      prisma.insumos.findMany({
        where: {
          activo: true,
          nombre: { contains: q, mode: "insensitive" },
        },
        orderBy: { nombre: "asc" },
        take: 5,
        select: { id: true, nombre: true, categoria: true, unidad: true },
      }),
    ]);

    const respuesta: Respuesta = {
      arbol,
      lotes: lotes.map((l) => ({ id: String(l.id), nombre: l.nombre })),
      personas: personas.map((p) => ({
        id: String(p.id),
        nombre_completo: p.nombre_completo,
        cedula: p.cedula,
      })),
      herramientas: herramientas.map((h) => ({
        id: String(h.id),
        nombre: h.nombre,
        categoria: h.categoria,
      })),
      insumos: insumos.map((i) => ({
        id: String(i.id),
        nombre: i.nombre,
        categoria: i.categoria,
        unidad: i.unidad,
      })),
    };

    return NextResponse.json(respuesta, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Error de búsqueda: ${(e as Error)?.message ?? "desconocido"}` },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificación manual rápida con curl o fetch (opcional)**

Si querés probar antes del UI, podés `npm run dev` y hacer en otra terminal:
```bash
curl -i "http://localhost:3000/api/jefe/buscar?q=al"
```

Sin sesión devolverá 403. Para probar con sesión, lo dejamos para el final con la UI.

- [ ] **Step 3: Commit**

```bash
git add "app/api/jefe/buscar/route.ts"
git commit -m "feat(jefe): endpoint busqueda global con parsing de sintaxis arbol"
```

---

## Tarea 2: Componente `BuscadorGlobal` (client)

**Files:**
- Create: `components/shared/BuscadorGlobal.tsx`

Modal con input + lista agrupada. Maneja debounce 200ms, AbortController, ESC, backdrop click, cierre al navegar.

- [ ] **Step 1: Crear archivo `components/shared/BuscadorGlobal.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add "components/shared/BuscadorGlobal.tsx"
git commit -m "feat(jefe): componente buscador global modal con resultados agrupados"
```

---

## Tarea 3: Integrar `BuscadorGlobal` en `HeaderApp` (condicional a rol JEFE) + build + push

**Files:**
- Modify: `components/shared/HeaderApp.tsx`

Renderizar `<BuscadorGlobal />` solo cuando el rol es JEFE. Va entre el avatar/nombre y el botón logout.

- [ ] **Step 1: Editar `components/shared/HeaderApp.tsx`**

Agregar import al inicio:

```tsx
import { BuscadorGlobal } from "./BuscadorGlobal";
```

Insertar el componente entre el bloque del `<Link>` del perfil y el `<form action={cerrarSesion}>` del logout. Es decir, el JSX queda así:

```tsx
      <div className="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3">
        <Link
          href="/mi-perfil"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 -mx-1 transition hover:bg-white/10"
          aria-label="Ir a mi perfil"
        >
          <AvatarIniciales
            id={usuario.id}
            nombre={usuario.nombre_completo}
            tamano="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base leading-tight">
              {usuario.nombre_completo}
            </p>
            <p className="text-xs uppercase tracking-wider text-zelanda-beige-100/80">
              {ETIQUETA_ROL[usuario.rol]} · La Zelanda
            </p>
          </div>
        </Link>
        {usuario.rol === "JEFE" ? <BuscadorGlobal /> : null}
        <form action={cerrarSesion}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg p-2 text-zelanda-beige-100 transition hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
```

(Solo cambia: agregar la línea `{usuario.rol === "JEFE" ? <BuscadorGlobal /> : null}` justo antes del `<form action={cerrarSesion}>`.)

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: termina con `✓ Compiled successfully`. La ruta `/api/jefe/buscar` aparece en la lista del output. Sin errores TS.

Si aparece error de TypeScript por tipos, revisar:
- En `route.ts`: que `prisma.lotes.findMany` con `mode: "insensitive"` sea válido (Prisma 6 lo soporta).
- En `BuscadorGlobal.tsx`: que `useRef<HTMLInputElement>(null)` sea correcto.

- [ ] **Step 3: Commit + push**

```bash
git add "components/shared/HeaderApp.tsx"
git commit -m "feat(jefe): integrar buscador global en header condicional al rol"
git push origin main
```

---

## Verificación final manual (después del deploy)

- [ ] Login como JEFE → header tiene lupa.
- [ ] Login como BODEGA / ALMACEN / TRABAJADOR → header **no** tiene lupa.
- [ ] Como JEFE, tap lupa → modal abre con input enfocado.
- [ ] ESC cierra el modal.
- [ ] Click en backdrop (afuera del modal) cierra.
- [ ] Tap X cierra.
- [ ] Input vacío → muestra hint "Escribí un nombre...".
- [ ] 1 carácter → no fetch (chequear Network tab).
- [ ] 2+ caracteres → fetch ocurre con debounce ~200ms.
- [ ] Tipear nombre de persona conocido → aparece en "Personas" → click → navega a `/jefe/equipo/<id>` y modal cierra.
- [ ] Tipear nombre de lote (ej. "Sale") → aparece "Salento" en "Lotes".
- [ ] Tipear "Salento 100" → tile destacado de árbol arriba + Salento en lotes.
- [ ] Tipear "100 Salento" → mismo resultado de árbol.
- [ ] Tipear "Salento 99999" → solo lote, sin árbol (fuera de rango).
- [ ] Tipear cédula conocida → aparece persona.
- [ ] Tipear nombre de herramienta → aparece + link a `/bodega/inventario/herramientas/<id>/editar`.
- [ ] Tipear nombre de insumo → aparece + link a `/bodega/inventario/insumos/<id>/historial`.
- [ ] Texto que no matchea nada → "Sin coincidencias."
- [ ] Como BODEGA, hacer `fetch("/api/jefe/buscar?q=test")` en DevTools → 403.
