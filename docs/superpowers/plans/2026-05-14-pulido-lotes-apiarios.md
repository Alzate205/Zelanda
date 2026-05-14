# Pulido lotes + apiarios + perfil — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir el núcleo existente con: edición de lote, lista/detalle/edición de apiario, perfil propio (datos + contraseña), opción de cerrar vinculación sin abrir otra, y acceso al perfil desde el header.

**Architecture:** Replicar el patrón ya consolidado en `equipo` (Server Actions con `useActionState`, formularios cliente con clases inline `inputBase`/`labelBase`, páginas server con `requerirUsuario` + Prisma). Sin cambios de schema, RLS ni dependencias. Cambio de contraseña vía `supabase.auth.updateUser` desde el cliente Supabase server-side existente (`@/lib/supabase/server`).

**Tech Stack:** Next.js 15.5 App Router · React 19 · TypeScript · Prisma 6.19 · Supabase Auth · Tailwind v3 · lucide-react.

**Spec base:** `docs/superpowers/specs/2026-05-14-pulido-lotes-apiarios-design.md`

**Convenciones del proyecto (recordatorio):**
- Idioma español (UI, código, commits).
- Sin emojis en UI.
- Mobile-first (botones ≥ 44x44 px, clase `min-h-touch`).
- Paleta `zelanda.{verde,ocre,beige}` + `estado.{aldia,proxima,vencida,neutro}`.
- Patrón de Server Actions: `EstadoEdicion = { error: string | null }` + `useActionState`.
- `requerirUsuario(rolRequerido?)` de `@/lib/auth`.
- `crearClienteSupabaseServidor()` de `@/lib/supabase/server`.
- `crearClienteSupabaseAdmin()` de `@/lib/supabase/admin` solo cuando se requiere bypass de RLS (no es el caso aquí — el usuario actualiza sus propios datos).

**Flujo de commits:** Cada tarea termina con un commit. Push a `main` solo al final del plan (o en bloques cohesivos) para evitar estados intermedios visibles en Vercel.

---

## Task 1: Editar lote — Server Action + tipo

**Files:**
- Create: `app/(app)/jefe/lotes/[id]/acciones.ts`

- [ ] **Step 1: Crear el archivo de acciones**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicionLote = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarLote(
  _prev: EstadoEdicionLote,
  formData: FormData,
): Promise<EstadoEdicionLote> {
  await requerirUsuario("JEFE");

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  if (!loteId) return { error: "ID de lote inválido." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const hectareasRaw = String(formData.get("hectareas") ?? "").trim();
  const fechaSiembraRaw = String(formData.get("fecha_siembra") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre) return { error: "El nombre del lote es obligatorio." };

  let hectareas: number | null = null;
  if (hectareasRaw) {
    const h = Number(hectareasRaw);
    if (!Number.isFinite(h) || h < 0) {
      return { error: "Hectáreas debe ser un número mayor o igual a cero." };
    }
    hectareas = h;
  }

  let fecha_siembra: Date | null = null;
  if (fechaSiembraRaw) {
    const f = new Date(fechaSiembraRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de siembra inválida." };
    }
    fecha_siembra = f;
  }

  // Validar nombre único entre lotes activos (excluyendo el actual)
  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null, NOT: { id: loteId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya hay otro lote con ese nombre." };
  }

  try {
    await prisma.lotes.update({
      where: { id: loteId },
      data: { nombre, hectareas, fecha_siembra, notas },
    });
  } catch (e) {
    return { error: `No se pudo actualizar el lote: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath("/jefe/lotes");
  redirect(`/jefe/lotes/${loteId}`);
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npm run build`
Expected: PASS (sin errores TS).

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin warnings nuevos.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/acciones.ts"
git commit -m "feat(lotes): server action actualizarLote con validaciones"
```

---

## Task 2: Editar lote — formulario cliente

**Files:**
- Create: `app/(app)/jefe/lotes/[id]/editar/FormularioEditarLote.tsx`

- [ ] **Step 1: Crear el formulario**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarLote, type EstadoEdicionLote } from "../acciones";

const ESTADO_INICIAL: EstadoEdicionLote = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Lote = {
  id: string;
  nombre: string;
  hectareas: string | null;
  fecha_siembra: string | null;
  notas: string | null;
};

export function FormularioEditarLote({ lote }: { lote: Lote }) {
  const [estado, accion, pendiente] = useActionState(actualizarLote, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="lote_id" value={lote.id} />

      <Link
        href={`/jefe/lotes/${lote.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {lote.nombre}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información del lote
        </h2>

        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={lote.nombre}
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hectareas" className={labelBase}>Hectáreas</label>
            <input
              id="hectareas"
              name="hectareas"
              type="number"
              min="0"
              step="0.01"
              defaultValue={lote.hectareas ?? ""}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="fecha_siembra" className={labelBase}>Fecha de siembra</label>
            <input
              id="fecha_siembra"
              name="fecha_siembra"
              type="date"
              defaultValue={lote.fecha_siembra ?? ""}
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>Notas</label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            defaultValue={lote.notas ?? ""}
            className={`${inputBase} min-h-[80px] resize-y`}
          />
        </div>
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
          href={`/jefe/lotes/${lote.id}`}
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
```

- [ ] **Step 2: Verificar compilación**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/editar/FormularioEditarLote.tsx"
git commit -m "feat(lotes): formulario cliente FormularioEditarLote"
```

---

## Task 3: Editar lote — page server

**Files:**
- Create: `app/(app)/jefe/lotes/[id]/editar/page.tsx`

- [ ] **Step 1: Crear page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarLote } from "./FormularioEditarLote";

export const metadata: Metadata = { title: "Editar lote" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function formatearISO(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function PaginaEditarLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      hectareas: true,
      fecha_siembra: true,
      notas: true,
      deleted_at: true,
    },
  });

  if (!lote || lote.deleted_at) notFound();

  return (
    <FormularioEditarLote
      lote={{
        id: String(lote.id),
        nombre: lote.nombre,
        hectareas: lote.hectareas !== null ? String(lote.hectareas) : null,
        fecha_siembra: formatearISO(lote.fecha_siembra),
        notas: lote.notas,
      }}
    />
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/editar/page.tsx"
git commit -m "feat(lotes): página /jefe/lotes/[id]/editar"
```

---

## Task 4: Botón Editar en detalle de lote

**Files:**
- Modify: `app/(app)/jefe/lotes/[id]/page.tsx`

- [ ] **Step 1: Agregar import de Pencil**

En el bloque de imports de `lucide-react` (línea 4 aprox), reemplazar:

```tsx
import { ChevronLeft, MapPin } from "lucide-react";
```

por:

```tsx
import { ChevronLeft, MapPin, Pencil } from "lucide-react";
```

- [ ] **Step 2: Agregar el botón Editar al header**

Localizar el `<header>` que contiene el `<h1>` con el nombre del lote (~líneas 70-77 en el archivo actual). Reemplazar:

```tsx
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Lote
        </p>
        <h1 className="mt-1 font-serif text-3xl text-zelanda-verde-900">
          {lote.nombre}
        </h1>
      </header>
```

por:

```tsx
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Lote
          </p>
          <h1 className="mt-1 font-serif text-3xl text-zelanda-verde-900">
            {lote.nombre}
          </h1>
        </div>
        <Link
          href={`/jefe/lotes/${lote.id}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>
```

- [ ] **Step 3: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS sin warnings nuevos.

- [ ] **Step 4: Verificación manual rápida**

Run: `npm run dev` (background)
- Navegar a `http://localhost:3000/jefe/lotes/1` después de loguear como jefe.
- Confirmar que el botón "Editar" aparece a la derecha del nombre del lote.
- Click → llega a `/jefe/lotes/1/editar`, formulario pre-llenado.
- Cambiar notas, Guardar → vuelve al detalle, notas actualizadas.
- Probar nombre vacío → error visible. Probar hectareas negativo → error.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/page.tsx"
git commit -m "feat(lotes): botón editar en detalle de lote"
```

---

## Task 5: Detalle de apiario

**Files:**
- Create: `app/(app)/jefe/apiarios/[id]/page.tsx`

- [ ] **Step 1: Crear el detalle**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Hexagon, MapPin } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) return { title: "Apiario no encontrado" };
  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: { nombre: true },
  });
  return { title: apiario?.nombre ?? "Apiario no encontrado" };
}

export default async function DetalleApiario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      total_colmenas: true,
      ubicacion_descripcion: true,
      activo: true,
    },
  });

  if (!apiario) notFound();

  const idStr = String(apiario.id);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/lotes"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lotes y apiarios
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Apiario
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-3xl text-zelanda-verde-900">
            <Hexagon className="h-6 w-6 shrink-0 text-zelanda-ocre-500" />
            {apiario.nombre}
          </h1>
          <div className="mt-2">
            {apiario.activo ? null : <BadgeBase tono="alerta">Inactivo</BadgeBase>}
          </div>
        </div>
        <Link
          href={`/jefe/apiarios/${idStr}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Hexagon className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-24 text-xs uppercase tracking-wider text-zelanda-verde-700">Colmenas</dt>
            <dd className="text-zelanda-verde-900">{apiario.total_colmenas}</dd>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-zelanda-verde-700">Ubicación</dt>
            <dd className="text-zelanda-verde-900">{apiario.ubicacion_descripcion ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Visitas y cosechas de miel
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Las tareas de visita al apiario y las cosechas de miel aparecerán
          aquí en la Fase 3.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/apiarios/[id]/page.tsx"
git commit -m "feat(apiarios): detalle /jefe/apiarios/[id]"
```

---

## Task 6: Editar apiario — Server Action

**Files:**
- Create: `app/(app)/jefe/apiarios/[id]/acciones.ts`

- [ ] **Step 1: Crear el Server Action**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicionApiario = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarApiario(
  _prev: EstadoEdicionApiario,
  formData: FormData,
): Promise<EstadoEdicionApiario> {
  await requerirUsuario("JEFE");

  const apiarioId = parsearId(String(formData.get("apiario_id") ?? ""));
  if (!apiarioId) return { error: "ID de apiario inválido." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const totalColmenasRaw = String(formData.get("total_colmenas") ?? "").trim();
  const ubicacion_descripcion =
    String(formData.get("ubicacion_descripcion") ?? "").trim() || null;
  const activo = formData.get("activo") === "on";

  if (!nombre) return { error: "El nombre del apiario es obligatorio." };

  if (!/^\d+$/.test(totalColmenasRaw)) {
    return { error: "Total de colmenas debe ser un número entero mayor o igual a cero." };
  }
  const total_colmenas = parseInt(totalColmenasRaw, 10);
  if (total_colmenas < 0) {
    return { error: "Total de colmenas no puede ser negativo." };
  }

  try {
    await prisma.apiarios.update({
      where: { id: apiarioId },
      data: { nombre, total_colmenas, ubicacion_descripcion, activo },
    });
  } catch (e) {
    return { error: `No se pudo actualizar el apiario: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath(`/jefe/apiarios/${apiarioId}`);
  revalidatePath("/jefe/lotes");
  redirect(`/jefe/apiarios/${apiarioId}`);
}
```

- [ ] **Step 2: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS sin warnings nuevos.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/apiarios/[id]/acciones.ts"
git commit -m "feat(apiarios): server action actualizarApiario"
```

---

## Task 7: Editar apiario — formulario + page

**Files:**
- Create: `app/(app)/jefe/apiarios/[id]/editar/FormularioEditarApiario.tsx`
- Create: `app/(app)/jefe/apiarios/[id]/editar/page.tsx`

- [ ] **Step 1: Crear el formulario cliente**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarApiario, type EstadoEdicionApiario } from "../acciones";

const ESTADO_INICIAL: EstadoEdicionApiario = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Apiario = {
  id: string;
  nombre: string;
  total_colmenas: number;
  ubicacion_descripcion: string | null;
  activo: boolean;
};

export function FormularioEditarApiario({ apiario }: { apiario: Apiario }) {
  const [estado, accion, pendiente] = useActionState(actualizarApiario, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="apiario_id" value={apiario.id} />

      <Link
        href={`/jefe/apiarios/${apiario.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {apiario.nombre}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {apiario.nombre}
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información del apiario
        </h2>

        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={apiario.nombre}
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="total_colmenas" className={labelBase}>Total de colmenas</label>
          <input
            id="total_colmenas"
            name="total_colmenas"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={apiario.total_colmenas}
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="ubicacion_descripcion" className={labelBase}>Ubicación</label>
          <textarea
            id="ubicacion_descripcion"
            name="ubicacion_descripcion"
            rows={2}
            defaultValue={apiario.ubicacion_descripcion ?? ""}
            className={`${inputBase} min-h-[60px] resize-y`}
            placeholder="Ej. Sector norte de la finca, junto a la quebrada"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={apiario.activo}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700"
          />
          <span className="text-sm">
            <span className="font-medium text-zelanda-verde-900">Apiario activo</span>
            <span className="mt-0.5 block text-xs text-zelanda-verde-700">
              Si lo desactivas, dejará de aparecer en la lista pública del mapa.
            </span>
          </span>
        </label>
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
          href={`/jefe/apiarios/${apiario.id}`}
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
```

- [ ] **Step 2: Crear la page server**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarApiario } from "./FormularioEditarApiario";

export const metadata: Metadata = { title: "Editar apiario" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarApiario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      total_colmenas: true,
      ubicacion_descripcion: true,
      activo: true,
    },
  });

  if (!apiario) notFound();

  return (
    <FormularioEditarApiario
      apiario={{
        id: String(apiario.id),
        nombre: apiario.nombre,
        total_colmenas: apiario.total_colmenas,
        ubicacion_descripcion: apiario.ubicacion_descripcion,
        activo: apiario.activo,
      }}
    />
  );
}
```

- [ ] **Step 3: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS sin warnings nuevos.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/apiarios/[id]/editar/"
git commit -m "feat(apiarios): página /jefe/apiarios/[id]/editar + formulario"
```

---

## Task 8: Sección apiarios en lista `/jefe/lotes`

**Files:**
- Modify: `app/(app)/jefe/lotes/page.tsx`

- [ ] **Step 1: Agregar import del ícono y Link**

En el archivo `app/(app)/jefe/lotes/page.tsx`, los imports actuales son:

```tsx
import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MapaFincaCargador } from "@/components/mapa/MapaFincaCargador";
```

Agregar el ícono Hexagon:

```tsx
import Link from "next/link";
import { Hexagon } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MapaFincaCargador } from "@/components/mapa/MapaFincaCargador";
```

- [ ] **Step 2: Ampliar la query de apiarios**

En la query `prisma.apiarios.findMany`, agregar `ubicacion_descripcion` al `select`. Reemplazar:

```tsx
    prisma.apiarios.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, total_colmenas: true },
      orderBy: { nombre: "asc" },
    }),
```

por:

```tsx
    prisma.apiarios.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        total_colmenas: true,
        ubicacion_descripcion: true,
      },
      orderBy: { nombre: "asc" },
    }),
```

- [ ] **Step 3: Cambiar el header para mostrar lotes y apiarios**

Reemplazar el `<header>` actual (que dice `Lotes` como h1 y `{lotes.length} lotes en la finca · {apiarios.length} apiarios`):

```tsx
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Cultivo
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Lotes
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {lotes.length} lotes en la finca · {apiarios.length} apiarios
        </p>
      </header>
```

por:

```tsx
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Cultivo y apicultura
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Lotes y apiarios
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {lotes.length} lotes · {apiarios.length} apiarios
        </p>
      </header>
```

- [ ] **Step 4: Envolver el grid de lotes en una sección con título**

Reemplazar el bloque actual del grid de lotes (último div con `grid grid-cols-1 gap-3 sm:grid-cols-2`):

```tsx
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lotes.map((lote) => (
          <Link
            key={Number(lote.id)}
            href={`/jefe/lotes/${lote.id}`}
            className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
          >
            <h3 className="font-serif text-lg text-zelanda-verde-900">
              {lote.nombre}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
              <span>
                {lote.total_arboles.toLocaleString("es-CO")} árboles
              </span>
              {lote.hectareas ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{Number(lote.hectareas)} ha</span>
                </>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
```

por (sección lotes + sección apiarios):

```tsx
      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Lotes <span className="text-sm text-zelanda-verde-700">({lotes.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lotes.map((lote) => (
            <Link
              key={Number(lote.id)}
              href={`/jefe/lotes/${lote.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <h3 className="font-serif text-lg text-zelanda-verde-900">
                {lote.nombre}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-zelanda-verde-700">
                <span>
                  {lote.total_arboles.toLocaleString("es-CO")} árboles
                </span>
                {lote.hectareas ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{Number(lote.hectareas)} ha</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Apiarios <span className="text-sm text-zelanda-verde-700">({apiarios.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apiarios.map((a) => (
            <Link
              key={Number(a.id)}
              href={`/jefe/apiarios/${a.id}`}
              className="block rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
            >
              <div className="flex items-center gap-2">
                <Hexagon className="h-4 w-4 shrink-0 text-zelanda-ocre-500" />
                <h3 className="font-serif text-lg text-zelanda-verde-900">
                  {a.nombre}
                </h3>
              </div>
              <div className="mt-1 text-xs text-zelanda-verde-700">
                {a.total_colmenas} colmenas
                {a.ubicacion_descripcion ? ` · ${a.ubicacion_descripcion}` : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>
```

- [ ] **Step 5: Verificar compilación, lint y dev**

Run: `npm run build && npm run lint`
Expected: PASS.

Verificación manual:
- Navegar a `/jefe/lotes`.
- Confirmar header dice "Lotes y apiarios".
- Confirmar 2 secciones separadas con título.
- Click en card de apiario → llega al detalle. Click "Editar" → al formulario. Cambiar colmenas → vuelta al detalle con valor nuevo.
- Toggle "Apiario activo" off → al volver a `/jefe/lotes` el apiario ya no aparece. Re-activar desde la BD o navegando a `/jefe/apiarios/[id]/editar` directo si conoces el id (alternativa: dejar para otra sesión).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/jefe/lotes/page.tsx"
git commit -m "feat(lotes): sección apiarios en la lista bajo el mapa"
```

---

## Task 9: Mi perfil — Server Actions

**Files:**
- Create: `app/(app)/mi-perfil/acciones.ts`

- [ ] **Step 1: Crear el archivo de acciones**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoPerfil = { error: string | null; exito: string | null };

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

export async function actualizarMisDatos(
  _prev: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, error: "Sesión no válida." };

  if (usuario.persona_id === null) {
    return {
      ...ESTADO_INICIAL,
      error:
        "Tu cuenta no está vinculada a una persona. Pídele al jefe que te asocie.",
    };
  }

  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre_completo) {
    return { ...ESTADO_INICIAL, error: "El nombre completo es obligatorio." };
  }

  try {
    await prisma.personas.update({
      where: { id: BigInt(usuario.persona_id) },
      data: { nombre_completo, cedula, telefono, notas },
    });
    // Mantener sincronizado el nombre en usuarios (para el header)
    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: { nombre_completo },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "desconocido";
    if (/unique constraint.*cedula/i.test(msg)) {
      return { ...ESTADO_INICIAL, error: "Esa cédula ya está registrada." };
    }
    return { ...ESTADO_INICIAL, error: `No se pudo guardar: ${msg}` };
  }

  revalidatePath("/mi-perfil");
  return { error: null, exito: "Datos guardados." };
}

export async function cambiarMiContrasena(
  _prev: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, error: "Sesión no válida." };

  const nueva = String(formData.get("contrasena_nueva") ?? "");
  const confirmacion = String(formData.get("contrasena_confirmacion") ?? "");

  if (nueva.length < 8) {
    return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (nueva !== confirmacion) {
    return { ...ESTADO_INICIAL, error: "Las contraseñas no coinciden." };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    return { ...ESTADO_INICIAL, error: `No se pudo cambiar: ${error.message}` };
  }

  return { error: null, exito: "Contraseña actualizada." };
}
```

- [ ] **Step 2: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS sin warnings nuevos.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/mi-perfil/acciones.ts"
git commit -m "feat(perfil): server actions actualizarMisDatos y cambiarMiContrasena"
```

---

## Task 10: Mi perfil — formularios cliente

**Files:**
- Create: `app/(app)/mi-perfil/FormularioMisDatos.tsx`
- Create: `app/(app)/mi-perfil/FormularioCambiarContrasena.tsx`

- [ ] **Step 1: Crear `FormularioMisDatos.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { actualizarMisDatos, type EstadoPerfil } from "./acciones";

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type DatosIniciales = {
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  notas: string | null;
  vinculadoAPersona: boolean;
};

export function FormularioMisDatos({ datos }: { datos: DatosIniciales }) {
  const [estado, accion, pendiente] = useActionState(actualizarMisDatos, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      {!datos.vinculadoAPersona ? (
        <p className="rounded-md border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-verde-800">
          Tu cuenta aún no está vinculada a una persona en la finca. Pídele
          al jefe que te asocie para poder editar tus datos.
        </p>
      ) : null}

      <div>
        <label htmlFor="nombre_completo" className={labelBase}>Nombre completo</label>
        <input
          id="nombre_completo"
          name="nombre_completo"
          type="text"
          required
          defaultValue={datos.nombre_completo}
          disabled={!datos.vinculadoAPersona}
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
            defaultValue={datos.cedula ?? ""}
            disabled={!datos.vinculadoAPersona}
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="telefono" className={labelBase}>Teléfono</label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            defaultValue={datos.telefono ?? ""}
            disabled={!datos.vinculadoAPersona}
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
          defaultValue={datos.notas ?? ""}
          disabled={!datos.vinculadoAPersona}
          className={`${inputBase} min-h-[60px] resize-y`}
        />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-estado-aldia/20 bg-estado-aldia/10 px-3 py-2 text-sm text-estado-aldia"
        >
          {estado.exito}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || !datos.vinculadoAPersona}
        className="w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Crear `FormularioCambiarContrasena.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { cambiarMiContrasena, type EstadoPerfil } from "./acciones";

const ESTADO_INICIAL: EstadoPerfil = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioCambiarContrasena() {
  const [estado, accion, pendiente] = useActionState(cambiarMiContrasena, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <div>
        <label htmlFor="contrasena_nueva" className={labelBase}>Nueva contraseña</label>
        <input
          id="contrasena_nueva"
          name="contrasena_nueva"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputBase}
        />
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Mínimo 8 caracteres.
        </p>
      </div>

      <div>
        <label htmlFor="contrasena_confirmacion" className={labelBase}>Confirmar contraseña</label>
        <input
          id="contrasena_confirmacion"
          name="contrasena_confirmacion"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputBase}
        />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-estado-aldia/20 bg-estado-aldia/10 px-3 py-2 text-sm text-estado-aldia"
        >
          {estado.exito}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mi-perfil/FormularioMisDatos.tsx" "app/(app)/mi-perfil/FormularioCambiarContrasena.tsx"
git commit -m "feat(perfil): formularios cliente mis datos y cambiar contraseña"
```

---

## Task 11: Mi perfil — page server

**Files:**
- Create: `app/(app)/mi-perfil/page.tsx`

- [ ] **Step 1: Crear la page**

```tsx
import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeBase, BadgeRol } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import type { TipoVinculacion } from "@/types";
import { FormularioMisDatos } from "./FormularioMisDatos";
import { FormularioCambiarContrasena } from "./FormularioCambiarContrasena";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PaginaMiPerfil() {
  const usuario = await requerirUsuario();

  const persona = usuario.persona_id
    ? await prisma.personas.findUnique({
        where: { id: BigInt(usuario.persona_id) },
        include: {
          vinculaciones: {
            where: { fecha_fin: null },
            take: 1,
            select: { tipo: true, rol_finca: true },
          },
        },
      })
    : null;

  const vincActiva = persona?.vinculaciones[0] ?? null;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <AvatarIniciales
          id={usuario.id}
          nombre={usuario.nombre_completo}
          tamano="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Mi perfil
          </p>
          <h1 className="mt-0.5 font-serif text-2xl leading-tight text-zelanda-verde-900">
            {usuario.nombre_completo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <BadgeRol rol={usuario.rol} />
            {vincActiva ? (
              <BadgeBase tono="info">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
                {vincActiva.rol_finca ? ` · ${vincActiva.rol_finca}` : ""}
              </BadgeBase>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos de acceso
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Correo</dt>
            <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zelanda-verde-700">
          Si necesitas cambiar tu correo o tu rol, pídele al jefe.
        </p>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Mis datos
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Tus datos personales en la finca.
        </p>
        <div className="mt-4">
          <FormularioMisDatos
            datos={{
              nombre_completo: persona?.nombre_completo ?? usuario.nombre_completo,
              cedula: persona?.cedula ?? null,
              telefono: persona?.telefono ?? null,
              notas: persona?.notas ?? null,
              vinculadoAPersona: persona !== null,
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Cambiar contraseña
        </h2>
        <div className="mt-4">
          <FormularioCambiarContrasena />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación, lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Verificación manual rápida**

Run dev server. Logueado como jefe, navegar a `http://localhost:3000/mi-perfil`:
- Ver datos personales + rol + vinculación activa.
- Cambiar teléfono, "Guardar cambios" → mensaje verde de éxito.
- Recargar → teléfono persiste.
- En "Cambiar contraseña", ingresar dos valores que no coinciden → mensaje rojo de error.
- Ingresar coincidentes (≥ 8 chars) → mensaje verde de éxito.
- Logout + login con la nueva contraseña → ok.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mi-perfil/page.tsx"
git commit -m "feat(perfil): página /mi-perfil con datos y cambio de contraseña"
```

---

## Task 12: Header — avatar y nombre clickables a `/mi-perfil`

**Files:**
- Modify: `components/shared/HeaderApp.tsx`

- [ ] **Step 1: Envolver el bloque avatar + nombre en un Link**

El archivo actual tiene esta estructura interna del header:

```tsx
        <AvatarIniciales … />
        <div className="min-w-0 flex-1">
          <p …>{usuario.nombre_completo}</p>
          <p …>{ETIQUETA_ROL[usuario.rol]} · La Zelanda</p>
        </div>
        <form action={cerrarSesion}>…</form>
```

Reemplazar el bloque entre `<div className="mx-auto flex …">` y el `<form>` para que el avatar + nombre sea un Link, manteniendo el logout aparte:

```tsx
import Link from "next/link";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
import { AvatarIniciales } from "./AvatarIniciales";
import { ETIQUETA_ROL } from "@/lib/constantes";
import type { UsuarioActual } from "@/lib/auth";

export function HeaderApp({ usuario }: { usuario: UsuarioActual }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zelanda-verde-900/20 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 text-zelanda-beige-50 shadow-suave">
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
    </header>
  );
}
```

- [ ] **Step 2: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Verificación manual**

Click en avatar/nombre del header (cualquier página) → llega a `/mi-perfil`. Click en logout sigue funcionando.

- [ ] **Step 4: Commit**

```bash
git add "components/shared/HeaderApp.tsx"
git commit -m "feat(header): avatar y nombre como enlace a /mi-perfil"
```

---

## Task 13: Cerrar vinculación sin abrir otra — Server Action

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/acciones.ts`

- [ ] **Step 1: Aceptar el nuevo modo en `actualizarPersonaYVinculacion`**

El archivo actual usa el flag `cambiar_vinculacion` (checkbox on/off). Hay que reemplazarlo por un campo `modo_vinculacion` con 3 valores: `"dejar" | "cambiar" | "cerrar"`. La parte de actualizar `personas` no cambia.

Reemplazar el archivo completo `app/(app)/jefe/equipo/[id]/acciones.ts` con:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import type { TipoVinculacion, TipoPeriodoPago } from "@/types";

export type EstadoEdicion = { error: string | null };

function esTipoValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}
function esPeriodoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}
function esModoValido(v: string): v is "dejar" | "cambiar" | "cerrar" {
  return v === "dejar" || v === "cambiar" || v === "cerrar";
}

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarPersonaYVinculacion(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  if (!personaId) return { error: "ID de persona inválido." };

  // --- Datos persona ---
  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre_completo) return { error: "Nombre completo obligatorio." };

  // --- Modo de vinculación ---
  const modoRaw = String(formData.get("modo_vinculacion") ?? "dejar");
  if (!esModoValido(modoRaw)) {
    return { error: "Modo de vinculación inválido." };
  }
  const modo = modoRaw;

  await prisma.personas.update({
    where: { id: personaId },
    data: { nombre_completo, cedula, telefono, notas },
  });

  if (modo === "dejar") {
    revalidatePath(`/jefe/equipo/${personaId}`);
    revalidatePath("/jefe/equipo");
    redirect(`/jefe/equipo/${personaId}`);
  }

  if (modo === "cerrar") {
    await prisma.vinculaciones.updateMany({
      where: { persona_id: personaId, fecha_fin: null },
      data: { fecha_fin: new Date() },
    });
    revalidatePath(`/jefe/equipo/${personaId}`);
    revalidatePath("/jefe/equipo");
    redirect(`/jefe/equipo/${personaId}`);
  }

  // modo === "cambiar"
  const tipoRaw = String(formData.get("nueva_tipo_vinculacion") ?? "");
  const rol_finca = String(formData.get("nueva_rol_finca") ?? "").trim() || null;
  const salarioRaw = String(formData.get("nueva_salario_base") ?? "").trim();
  const periodoRaw = String(formData.get("nueva_periodo_pago") ?? "");
  const tarifaRaw = String(formData.get("nueva_tarifa_jornal") ?? "").trim();

  if (!esTipoValido(tipoRaw)) {
    return { error: "Tipo de vinculación inválido." };
  }
  const tipo = tipoRaw;

  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;

  if (tipo === "FIJO") {
    const s = Number(salarioRaw);
    if (!Number.isFinite(s) || s <= 0) {
      return { error: "Salario base inválido para FIJO." };
    }
    salario_base = s;
    if (!esPeriodoValido(periodoRaw)) {
      return { error: "Período de pago inválido para FIJO." };
    }
    periodo_pago = periodoRaw;
  } else if (tipo === "JORNALERO") {
    const t = Number(tarifaRaw);
    if (!Number.isFinite(t) || t <= 0) {
      return { error: "Tarifa por jornal inválida para JORNALERO." };
    }
    tarifa_jornal = t;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vinculaciones.updateMany({
      where: { persona_id: personaId, fecha_fin: null },
      data: { fecha_fin: new Date() },
    });
    await tx.vinculaciones.create({
      data: {
        persona_id: personaId,
        tipo,
        rol_finca,
        salario_base,
        periodo_pago,
        tarifa_jornal,
      },
    });
  });

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/equipo/[id]/acciones.ts"
git commit -m "feat(equipo): modo de vinculación con 3 valores (dejar/cambiar/cerrar)"
```

---

## Task 14: Cerrar vinculación sin abrir otra — Formulario

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`

- [ ] **Step 1: Reemplazar el bloque de "checkbox cambiar vinculación" por un radio group de 3 opciones**

El archivo actual tiene un `useState<boolean>` para `cambiarVinc` y un `useState<TipoVinculacion>` para `nuevoTipo`. Reemplazar todo el contenido del archivo con:

```tsx
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
            hoy y la persona aparecerá como "Sin vinculación" hasta que se
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
```

- [ ] **Step 2: Verificar compilación y lint**

Run: `npm run build && npm run lint`
Expected: PASS sin warnings nuevos.

- [ ] **Step 3: Verificación manual**

En dev server, logueado como jefe:
1. Navegar a un miembro existente con vinculación activa.
2. Editar → seleccionar "Cerrarla (sin abrir nueva)" → guardar.
3. Detalle muestra "Sin vinculación activa".
4. Histórico muestra la anterior con fecha_fin = hoy.
5. Lista de equipo muestra badge "Sin vinculación" para esa persona.
6. Volver a editar → seleccionar "Cambiar a otro tipo" → FIJO con salario válido → guardar → la nueva vinculación queda activa.
7. Probar "Dejarla como está" → solo guarda datos personales, vinculación intacta.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx"
git commit -m "feat(equipo): radio dejar/cambiar/cerrar en editar miembro"
```

---

## Task 15: Verificación integral y push

- [ ] **Step 1: Build completo limpio**

Run: `npm run build`
Expected: PASS sin errores.

- [ ] **Step 2: Lint completo limpio**

Run: `npm run lint`
Expected: sin warnings nuevos respecto a la baseline.

- [ ] **Step 3: Smoke test manual completo**

Logueado como jefe en `npm run dev`:

| Flujo | Resultado esperado |
|---|---|
| `/jefe/lotes` | Header "Lotes y apiarios"; 2 secciones (15 lotes, 2 apiarios) |
| Click en card de apiario "El Cedro" | Llega a `/jefe/apiarios/[id]`, info correcta |
| `/jefe/apiarios/[id]` → Editar → cambiar colmenas a 15 → Guardar | Vuelve al detalle con 15 |
| `/jefe/lotes/1` → Editar → cambiar notas → Guardar | Vuelve al detalle con notas nuevas |
| Click avatar/nombre del header | Llega a `/mi-perfil` |
| `/mi-perfil` → cambiar teléfono → Guardar | Mensaje verde, dato persiste tras recargar |
| `/mi-perfil` → cambiar contraseña (≥ 8, coinciden) → Cambiar | Mensaje verde |
| Logout + login con contraseña nueva | OK |
| `/jefe/equipo/[id]/editar` → "Cerrarla (sin abrir nueva)" → Guardar | Detalle "Sin vinculación", histórico cierra |

- [ ] **Step 4: Push a `main`**

Si todo OK:

```bash
git push origin main
```

Vercel auto-deploya. Verificar deploy en https://zelanda.vercel.app.

- [ ] **Step 5: Actualizar la memoria del proyecto**

Actualizar `C:\Users\samue\.claude\projects\d--Zelanda\memory\project_fincapp.md` cambiando la línea de **Estado actual** para reflejar:

- Editar lote operativo.
- Apiarios con lista/detalle/edición.
- Mi perfil (datos personales + cambio de contraseña) accesible desde el header.
- Vinculación con opción de cerrar sin abrir otra.

---

## Self-review del plan

**1. Spec coverage:**
- Editar lote (spec §2.1, §5.1, §6, §7) → Tasks 1-4 ✓
- Detalle apiario (spec §2.2, §5.2, §6) → Task 5 ✓
- Editar apiario (spec §2.3, §5.3, §6, §7) → Tasks 6-7 ✓
- Sección apiarios en lista (spec §2.4, §5.4, §8) → Task 8 ✓
- Mi perfil + cambiar contraseña (spec §2.5, §3.6-3.8, §5.5, §6, §7) → Tasks 9-11 ✓
- Cerrar vinculación sin abrir otra (spec §2.6, §3.9, §5.6, §6) → Tasks 13-14 ✓
- Header con acceso a Mi perfil (spec §2.7, §5.7) → Task 12 ✓
- Sin cambios de schema/RLS (spec §9) → confirmado en plan ✓
- Decisión D-014 (no auto-desactivar al cerrar) → reflejado en task 13 (no toca `personas.activo`) ✓

**2. Placeholder scan:** Sin "TBD", "TODO", "similar to", ni código incompleto. Cada step tiene código real ejecutable.

**3. Type consistency:**
- `EstadoEdicionLote`, `EstadoEdicionApiario`, `EstadoEdicion`, `EstadoPerfil` — todos distintos, definidos en sus respectivas tasks, importados con el mismo nombre donde se usan ✓
- `actualizarLote` (Task 1) llamado en Task 2 ✓
- `actualizarApiario` (Task 6) llamado en Task 7 ✓
- `actualizarPersonaYVinculacion` (Task 13) — Task 14 lo importa del mismo path; firma compatible (sigue siendo `(_prev, formData) => Promise<EstadoEdicion>`) ✓
- `FormularioEditarLote`, `FormularioEditarApiario`, `FormularioMisDatos`, `FormularioCambiarContrasena` — cada uno se exporta del archivo donde se define y se importa exactamente con ese nombre en su page server ✓
- `modo_vinculacion` (campo en formulario Task 14) coincide con `formData.get("modo_vinculacion")` en Task 13 ✓
- `obtenerUsuarioActual` importado desde `@/lib/auth` en Task 9 — existe en `lib/auth.ts` ✓
- `crearClienteSupabaseServidor` importado en Task 9 — existe en `lib/supabase/server.ts` ✓
