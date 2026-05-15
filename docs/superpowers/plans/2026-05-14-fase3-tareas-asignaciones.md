# Fase 3 — Tareas y asignaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el ciclo operativo completo de la finca: catálogo de tipos de tarea, frecuencias por lote, asignaciones (lote o apiario), registros de avance (TRAMO/SUELTOS/VISITA), novedades con foto, próximas fechas y alertas, dashboard del jefe.

**Architecture:** Schema migration mínima (apicultura en asignaciones + VISITA en enum). Reutilizar al máximo los patrones ya establecidos: Server Actions con `useActionState`, formularios cliente con `inputBase`/`labelBase` inline, pages server con `requerirUsuario` + Prisma. Foto vía Supabase Storage bucket "fotos" con RLS abierto a autenticados.

**Tech Stack:** Next.js 15.5 App Router · React 19 · TypeScript · Prisma 6.19 · Supabase (Auth + Storage) · Tailwind v3 · lucide-react.

**Spec base:** [`docs/superpowers/specs/2026-05-14-fase3-tareas-asignaciones-design.md`](../specs/2026-05-14-fase3-tareas-asignaciones-design.md)

**Patrones a replicar (lectura previa recomendada):**
- Server Action: [app/(app)/jefe/equipo/[id]/acciones.ts](../../../app/(app)/jefe/equipo/[id]/acciones.ts)
- Form cliente: [app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx](../../../app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx)
- Page detalle: [app/(app)/jefe/equipo/[id]/page.tsx](../../../app/(app)/jefe/equipo/[id]/page.tsx)
- Page lista: [app/(app)/jefe/equipo/page.tsx](../../../app/(app)/jefe/equipo/page.tsx)

**Convenciones recordatorio:**
- Idioma español obligatorio (UI, código, commits).
- Sin emojis en UI (CLAUDE.md §8).
- Mobile-first: `min-h-touch` (44px) en inputs/botones.
- Paleta: `zelanda.{verde,ocre,beige}` + `estado.{aldia,proxima,vencida,neutro}`.
- Tipos: `EstadoEdicion = { error: string | null }` o `EstadoEdicionConExito = { error: string | null; exito: string | null }`.

**Flujo de commits:** Cada tarea termina con un commit. Push a `main` solo en la tarea final (Task 27) tras verificación integral.

---

## Task 1: Schema migration — apicultura + VISITA

**Files:**
- Create: `supabase/migracion-fase3-apicultura.sql`
- Modify: `prisma/schema.prisma` (vía `prisma db pull`)

- [ ] **Step 1: Crear el SQL idempotente**

```sql
-- supabase/migracion-fase3-apicultura.sql

BEGIN;

-- 1. asignaciones acepta lote O apiario (XOR)
ALTER TABLE public.asignaciones
  ALTER COLUMN lote_id DROP NOT NULL;

ALTER TABLE public.asignaciones
  ADD COLUMN IF NOT EXISTS apiario_id BIGINT
  REFERENCES public.apiarios(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_asign_lote_xor_apiario'
  ) THEN
    ALTER TABLE public.asignaciones
      ADD CONSTRAINT chk_asign_lote_xor_apiario
      CHECK (
        (lote_id IS NOT NULL AND apiario_id IS NULL) OR
        (lote_id IS NULL AND apiario_id IS NOT NULL)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_asign_apiario
  ON public.asignaciones(apiario_id);

-- 2. tipo_registro suma VISITA (apicultura)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'VISITA'
      AND enumtypid = 'public.tipo_registro'::regtype
  ) THEN
    ALTER TYPE public.tipo_registro ADD VALUE 'VISITA';
  END IF;
END
$$;

COMMIT;
```

- [ ] **Step 2: Ejecutar la migración en Supabase**

Abrir el SQL editor de Supabase y correr el contenido completo del archivo. Verificar con:

```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'asignaciones' AND column_name IN ('lote_id', 'apiario_id');
-- lote_id: YES, apiario_id: YES

SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.tipo_registro'::regtype
ORDER BY enumsortorder;
-- TRAMO, SUELTOS, VISITA
```

- [ ] **Step 3: Sincronizar Prisma**

```bash
npx prisma db pull
npx prisma generate
```

Verificar que `prisma/schema.prisma` ahora muestra:
- `apiario_id BigInt?` en model asignaciones.
- `lote_id BigInt?` (nullable ahora).
- `VISITA` agregado al `enum tipo_registro`.

- [ ] **Step 4: Build limpio**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migracion-fase3-apicultura.sql prisma/schema.prisma
git commit -m "feat(schema): asignaciones acepta apiario y enum tipo_registro suma VISITA"
```

---

## Task 2: Helpers Supabase Storage

**Files:**
- Create: `lib/supabase/storage.ts`
- Manual: crear bucket "fotos" en Supabase Dashboard

- [ ] **Step 1: Crear el bucket en Supabase Dashboard**

En Supabase → Storage → New bucket:
- Nombre: `fotos`
- Public: **No** (privado; acceso vía signed URLs)
- File size limit: 5 MB
- Allowed MIME types: `image/jpeg, image/png, image/webp`

En Storage Policies para el bucket `fotos`:

```sql
-- Subir: usuarios autenticados pueden subir
CREATE POLICY "fotos_insert_autenticados"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fotos');

-- Leer: usuarios autenticados pueden leer
CREATE POLICY "fotos_select_autenticados"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fotos');
```

- [ ] **Step 2: Crear el helper**

```ts
// lib/supabase/storage.ts
import "server-only";
import { crearClienteSupabaseServidor } from "./server";

const BUCKET = "fotos";

export async function subirFoto(
  file: File,
  carpeta: "novedades" | "avance",
): Promise<{ path: string } | { error: string }> {
  const supabase = await crearClienteSupabaseServidor();
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${carpeta}/${ts}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) return { error: error.message };
  return { path };
}

export async function urlFotoFirmada(
  path: string,
  segundos = 60 * 60,
): Promise<string | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, segundos);
  return data?.signedUrl ?? null;
}
```

- [ ] **Step 3: Build + lint**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/storage.ts
git commit -m "feat(storage): bucket fotos y helpers subirFoto/urlFotoFirmada"
```

---

## Task 3: Componente SubirFoto cliente

**Files:**
- Create: `components/shared/SubirFoto.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export function SubirFoto({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  function alSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreview(null);
      setNombreArchivo(null);
      return;
    }
    setNombreArchivo(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function limpiar() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setNombreArchivo(null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={alSeleccionar}
        className="sr-only"
        id={`input-${name}`}
      />
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Vista previa"
            className="max-h-64 w-full rounded-lg border border-zelanda-beige-300 object-cover"
          />
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-zelanda-verde-900/80 text-zelanda-beige-50 shadow-lg"
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mt-1.5 truncate text-xs text-zelanda-verde-700">
            {nombreArchivo}
          </p>
        </div>
      ) : (
        <label
          htmlFor={`input-${name}`}
          className="flex min-h-touch w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zelanda-beige-300 bg-zelanda-beige-50 px-4 py-6 text-sm text-zelanda-verde-700 transition hover:border-zelanda-verde-300 hover:bg-zelanda-beige-100"
        >
          <Camera className="h-5 w-5" />
          Tomar foto o elegir archivo
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/shared/SubirFoto.tsx
git commit -m "feat(shared): componente SubirFoto cliente con preview"
```

---

## Task 4: Editar lote — agregar campo `total_arboles` + generar árboles

**Files:**
- Modify: `app/(app)/jefe/lotes/[id]/acciones.ts`
- Modify: `app/(app)/jefe/lotes/[id]/editar/FormularioEditarLote.tsx`
- Modify: `app/(app)/jefe/lotes/[id]/editar/page.tsx`

- [ ] **Step 1: Extender el Server Action `actualizarLote`**

Reescribir completo `app/(app)/jefe/lotes/[id]/acciones.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicionLote = { error: string | null; aviso: string | null };

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
  if (!loteId) return { error: "ID de lote inválido.", aviso: null };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const hectareasRaw = String(formData.get("hectareas") ?? "").trim();
  const fechaSiembraRaw = String(formData.get("fecha_siembra") ?? "").trim();
  const totalArbolesRaw = String(formData.get("total_arboles") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre) return { error: "El nombre del lote es obligatorio.", aviso: null };

  let hectareas: number | null = null;
  if (hectareasRaw) {
    const h = Number(hectareasRaw);
    if (!Number.isFinite(h) || h < 0) {
      return { error: "Hectáreas debe ser un número mayor o igual a cero.", aviso: null };
    }
    hectareas = h;
  }

  let fecha_siembra: Date | null = null;
  if (fechaSiembraRaw) {
    const f = new Date(fechaSiembraRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de siembra inválida.", aviso: null };
    }
    fecha_siembra = f;
  }

  if (!/^\d+$/.test(totalArbolesRaw)) {
    return { error: "Total de árboles debe ser un entero >= 0.", aviso: null };
  }
  const total_arboles = parseInt(totalArbolesRaw, 10);
  if (total_arboles < 0) {
    return { error: "Total de árboles no puede ser negativo.", aviso: null };
  }

  const duplicado = await prisma.lotes.findFirst({
    where: { nombre, deleted_at: null, NOT: { id: loteId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya hay otro lote con ese nombre.", aviso: null };
  }

  // Contar árboles ya generados (no soft-deleted)
  const arbolesActuales = await prisma.arboles.count({
    where: { lote_id: loteId, deleted_at: null },
  });

  let aviso: string | null = null;

  try {
    await prisma.lotes.update({
      where: { id: loteId },
      data: { nombre, hectareas, fecha_siembra, total_arboles, notas },
    });

    if (total_arboles > arbolesActuales) {
      // Generar los faltantes
      const desde = arbolesActuales + 1;
      const hasta = total_arboles;
      const data = Array.from({ length: hasta - arbolesActuales }, (_, i) => ({
        lote_id: loteId,
        numero_placa: desde + i,
      }));
      await prisma.arboles.createMany({
        data,
        skipDuplicates: true,
      });
      aviso = `Se generaron ${hasta - arbolesActuales} árboles nuevos (placas ${desde}–${hasta}).`;
    } else if (total_arboles < arbolesActuales) {
      aviso = `Hay ${arbolesActuales - total_arboles} árboles por encima del nuevo total. No se borraron — manejarlos manualmente si es necesario.`;
    }
  } catch (e) {
    return {
      error: `No se pudo actualizar el lote: ${(e as Error)?.message ?? "desconocido"}.`,
      aviso: null,
    };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath("/jefe/lotes");

  if (aviso) {
    // Si hay aviso, no redirigir — mostrar mensaje y dejar al jefe ver el resultado
    return { error: null, aviso };
  }
  redirect(`/jefe/lotes/${loteId}`);
}
```

- [ ] **Step 2: Actualizar `FormularioEditarLote.tsx`**

Cambios necesarios:
1. Importar `type EstadoEdicionLote` (ahora tiene `aviso` también).
2. ESTADO_INICIAL = `{ error: null, aviso: null }`.
3. El tipo `Lote` agrega `total_arboles: number`.
4. Agregar campo input `total_arboles` después del de `hectareas` (grid de 2 columnas se vuelve de 3, o cambiar layout).
5. Render del aviso (en verde/ocre) si `estado.aviso` existe — antes del error.

Estructura del JSX a agregar en la sección "Información del lote":

```tsx
<div>
  <label htmlFor="total_arboles" className={labelBase}>
    Total de árboles
  </label>
  <input
    id="total_arboles"
    name="total_arboles"
    type="number"
    min="0"
    step="1"
    required
    defaultValue={lote.total_arboles}
    className={inputBase}
  />
  <p className="mt-1 text-xs text-zelanda-verde-700">
    Si aumentas este número, se generarán los árboles faltantes
    (numerados 1..N) automáticamente.
  </p>
</div>
```

Cambiar el bloque del grid de 2 columnas (hectareas + fecha_siembra) a 3 columnas usando `sm:grid-cols-3` y agregando `total_arboles` como tercera columna. Alternativa más mobile-friendly: dejar `total_arboles` en una fila propia full-width y mantener hectareas+fecha en grid de 2.

Bloque para mostrar aviso (antes del bloque de error existente):

```tsx
{estado.aviso ? (
  <p
    role="status"
    className="rounded-md border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-verde-800"
  >
    {estado.aviso}
  </p>
) : null}
```

Update tipo `Lote`:
```tsx
type Lote = {
  id: string;
  nombre: string;
  hectareas: string | null;
  fecha_siembra: string | null;
  total_arboles: number;
  notas: string | null;
};
```

- [ ] **Step 3: Actualizar `page.tsx` para pasar `total_arboles`**

En `app/(app)/jefe/lotes/[id]/editar/page.tsx`, en el `select` de prisma agregar `total_arboles: true`, y en el `<FormularioEditarLote lote={{ ..., total_arboles: lote.total_arboles }} />` pasarlo.

- [ ] **Step 4: Build + lint**

```bash
npm run build && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/acciones.ts" "app/(app)/jefe/lotes/[id]/editar/"
git commit -m "feat(lotes): editar total_arboles dispara generación idempotente"
```

---

## Task 5: Detalle de lote — mostrar conteo real de árboles

**Files:**
- Modify: `app/(app)/jefe/lotes/[id]/page.tsx`

- [ ] **Step 1: Agregar count de árboles a la query**

En `DetalleLote`, después de la query de `lote`, agregar:

```tsx
const arbolesGenerados = await prisma.arboles.count({
  where: { lote_id: idBig, deleted_at: null },
});
```

- [ ] **Step 2: Reemplazar la fila "Polígono" del dl por una fila "Árboles cargados"**

En la sección "Información", reemplazar:

```tsx
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Polígono
            </dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-zelanda-verde-900">
              <MapPin className="h-3.5 w-3.5 text-zelanda-ocre-500" />
              Pendiente
            </dd>
          </div>
```

por:

```tsx
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Árboles cargados
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {arbolesGenerados.toLocaleString("es-CO")} / {lote.total_arboles.toLocaleString("es-CO")}
              {arbolesGenerados < lote.total_arboles ? (
                <span className="ml-2 text-xs text-zelanda-ocre-600">
                  (faltan {(lote.total_arboles - arbolesGenerados).toLocaleString("es-CO")})
                </span>
              ) : null}
            </dd>
          </div>
```

- [ ] **Step 3: Build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/page.tsx"
git commit -m "feat(lotes): detalle muestra árboles cargados vs total"
```

---

## Task 6: Catálogo tipos de tarea — Server Actions

**Files:**
- Create: `app/(app)/jefe/tareas/acciones.ts`

- [ ] **Step 1: Crear las acciones**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoTipoTarea = { error: string | null };

function esAreaValida(v: string): v is "CULTIVO" | "APICULTURA" {
  return v === "CULTIVO" || v === "APICULTURA";
}

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function leerCampos(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const frecRaw = String(formData.get("frecuencia_dias_default") ?? "").trim();
  const areaRaw = String(formData.get("area") ?? "");
  const color = String(formData.get("color") ?? "").trim() || null;
  const icono = String(formData.get("icono") ?? "").trim() || null;
  return { nombre, descripcion, frecRaw, areaRaw, color, icono };
}

export async function crearTipoTarea(
  _prev: EstadoTipoTarea,
  formData: FormData,
): Promise<EstadoTipoTarea> {
  await requerirUsuario("JEFE");

  const { nombre, descripcion, frecRaw, areaRaw, color, icono } = leerCampos(formData);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!/^\d+$/.test(frecRaw)) {
    return { error: "Frecuencia debe ser un entero positivo." };
  }
  const frecuencia_dias_default = parseInt(frecRaw, 10);
  if (frecuencia_dias_default <= 0) {
    return { error: "Frecuencia debe ser mayor a cero." };
  }
  if (!esAreaValida(areaRaw)) {
    return { error: "Área inválida." };
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Color debe estar en formato #RRGGBB." };
  }

  try {
    await prisma.tipos_tarea.create({
      data: {
        nombre,
        descripcion,
        frecuencia_dias_default,
        area: areaRaw,
        color,
        icono,
        activo: true,
      },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? "desconocido";
    if (/unique constraint.*nombre/i.test(msg)) {
      return { error: "Ya existe un tipo de tarea con ese nombre." };
    }
    return { error: `No se pudo crear: ${msg}` };
  }

  revalidatePath("/jefe/tareas");
  redirect("/jefe/tareas");
}

export async function actualizarTipoTarea(
  _prev: EstadoTipoTarea,
  formData: FormData,
): Promise<EstadoTipoTarea> {
  await requerirUsuario("JEFE");

  const tipoId = parsearId(String(formData.get("tipo_id") ?? ""));
  if (!tipoId) return { error: "ID inválido." };

  const { nombre, descripcion, frecRaw, color, icono } = leerCampos(formData);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!/^\d+$/.test(frecRaw)) {
    return { error: "Frecuencia debe ser un entero positivo." };
  }
  const frecuencia_dias_default = parseInt(frecRaw, 10);
  if (frecuencia_dias_default <= 0) {
    return { error: "Frecuencia debe ser mayor a cero." };
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Color debe estar en formato #RRGGBB." };
  }

  // No editamos area: bloqueado para preservar histórico.

  const duplicado = await prisma.tipos_tarea.findFirst({
    where: { nombre, NOT: { id: tipoId } },
    select: { id: true },
  });
  if (duplicado) {
    return { error: "Ya existe otro tipo con ese nombre." };
  }

  try {
    await prisma.tipos_tarea.update({
      where: { id: tipoId },
      data: { nombre, descripcion, frecuencia_dias_default, color, icono },
    });
  } catch (e) {
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath("/jefe/tareas");
  revalidatePath(`/jefe/tareas/${tipoId}/editar`);
  redirect("/jefe/tareas");
}

export async function cambiarEstadoTipo(formData: FormData) {
  await requerirUsuario("JEFE");
  const tipoId = parsearId(String(formData.get("tipo_id") ?? ""));
  if (!tipoId) return;
  const activar = formData.get("activar") === "true";
  await prisma.tipos_tarea.update({
    where: { id: tipoId },
    data: { activo: activar },
  });
  revalidatePath("/jefe/tareas");
}
```

- [ ] **Step 2: Build + lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/tareas/acciones.ts"
git commit -m "feat(tareas): server actions catálogo tipos de tarea"
```

---

## Task 7: Catálogo tipos — pantalla lista

**Files:**
- Create: `app/(app)/jefe/tareas/page.tsx`

- [ ] **Step 1: Crear la page**

```tsx
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { cambiarEstadoTipo } from "./acciones";

export const metadata = { title: "Tipos de tarea" };

export default async function PaginaTipos() {
  await requerirUsuario("JEFE");

  const tipos = await prisma.tipos_tarea.findMany({
    orderBy: [{ area: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      area: true,
      frecuencia_dias_default: true,
      activo: true,
      _count: { select: { asignaciones: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Configuración
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Tipos de tarea
          </h1>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            {tipos.filter((t) => t.activo).length} activos · {tipos.length} en total
          </p>
        </div>
        <Link
          href="/jefe/tareas/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3.5 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </header>

      <ul className="space-y-2">
        {tipos.map((t) => {
          const idStr = String(t.id);
          return (
            <li
              key={idStr}
              className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
            >
              <Link
                href={`/jefe/tareas/${idStr}/editar`}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {t.nombre}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <BadgeBase tono="info">{t.area}</BadgeBase>
                    <span className="text-xs text-zelanda-verde-700">
                      cada {t.frecuencia_dias_default} días
                    </span>
                    <span className="text-xs text-zelanda-verde-700">
                      · {t._count.asignaciones} asignaciones
                    </span>
                    {!t.activo ? (
                      <BadgeBase tono="alerta">Inactivo</BadgeBase>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
              </Link>
              <form action={cambiarEstadoTipo}>
                <input type="hidden" name="tipo_id" value={idStr} />
                <input
                  type="hidden"
                  name="activar"
                  value={t.activo ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="min-h-touch rounded-lg px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:bg-zelanda-beige-100 hover:text-zelanda-verde-900"
                >
                  {t.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/tareas/page.tsx"
git commit -m "feat(tareas): pantalla lista de tipos de tarea"
```

---

## Task 8: Catálogo tipos — pantalla "Nuevo tipo"

**Files:**
- Create: `app/(app)/jefe/tareas/nuevo/page.tsx`
- Create: `app/(app)/jefe/tareas/nuevo/FormularioNuevoTipo.tsx`

- [ ] **Step 1: Crear el formulario cliente**

Patrón: replica de `FormularioEditarMiembro.tsx` adaptado. Estructura:
- Inputs: `nombre` (text required), `descripcion` (textarea), `frecuencia_dias_default` (number min=1), `area` (select CULTIVO/APICULTURA), `color` (text con placeholder `#7e3a17`), `icono` (text con placeholder `droplet`).
- Importa `crearTipoTarea, EstadoTipoTarea` de `../acciones`.
- ESTADO_INICIAL = `{ error: null }`.
- Botón "Cancelar" → `/jefe/tareas`, "Guardar".

Código completo:

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearTipoTarea, type EstadoTipoTarea } from "../acciones";

const ESTADO_INICIAL: EstadoTipoTarea = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioNuevoTipo() {
  const [estado, accion, pendiente] = useActionState(crearTipoTarea, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/tareas"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Tipos de tarea
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Crear
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo tipo de tarea
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div>
          <label htmlFor="nombre" className={labelBase}>Nombre</label>
          <input id="nombre" name="nombre" type="text" required className={inputBase} />
        </div>

        <div>
          <label htmlFor="descripcion" className={labelBase}>Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="frecuencia_dias_default" className={labelBase}>
              Frecuencia (días)
            </label>
            <input
              id="frecuencia_dias_default"
              name="frecuencia_dias_default"
              type="number"
              min="1"
              step="1"
              required
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="area" className={labelBase}>Área</label>
            <select id="area" name="area" required defaultValue="CULTIVO" className={inputBase}>
              <option value="CULTIVO">Cultivo</option>
              <option value="APICULTURA">Apicultura</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="color" className={labelBase}>Color (hex, opcional)</label>
            <input
              id="color"
              name="color"
              type="text"
              placeholder="#7e3a17"
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="icono" className={labelBase}>Ícono lucide (opcional)</label>
            <input
              id="icono"
              name="icono"
              type="text"
              placeholder="droplet"
              className={inputBase}
            />
          </div>
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
          href="/jefe/tareas"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Crear la page**

```tsx
// app/(app)/jefe/tareas/nuevo/page.tsx
import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { FormularioNuevoTipo } from "./FormularioNuevoTipo";

export const metadata: Metadata = { title: "Nuevo tipo de tarea" };

export default async function PaginaNuevoTipo() {
  await requerirUsuario("JEFE");
  return <FormularioNuevoTipo />;
}
```

- [ ] **Step 3: Build + lint**

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/tareas/nuevo/"
git commit -m "feat(tareas): pantalla y formulario nuevo tipo"
```

---

## Task 9: Catálogo tipos — pantalla "Editar tipo"

**Files:**
- Create: `app/(app)/jefe/tareas/[id]/editar/page.tsx`
- Create: `app/(app)/jefe/tareas/[id]/editar/FormularioEditarTipo.tsx`

- [ ] **Step 1: Crear el formulario cliente**

Mismo patrón que `FormularioNuevoTipo` pero:
- Importa `actualizarTipoTarea` de `../../acciones` (2 niveles arriba).
- Recibe prop `tipo: { id, nombre, descripcion, frecuencia_dias_default, area, color, icono }`.
- Input hidden `tipo_id`.
- `area` se muestra como texto disabled (no se puede cambiar — explicar al usuario en un texto pequeño "El área no se puede modificar una vez creado el tipo").
- Botón "Guardar" en vez de "Crear".

Estructura del archivo similar al de Task 8 pero con `defaultValue` en cada input.

Para el campo `area` que es bloqueado:

```tsx
<div>
  <label htmlFor="area" className={labelBase}>Área</label>
  <input
    id="area"
    type="text"
    value={tipo.area === "CULTIVO" ? "Cultivo" : "Apicultura"}
    disabled
    className={`${inputBase} cursor-not-allowed opacity-60`}
  />
  <p className="mt-1 text-xs text-zelanda-verde-700">
    El área no se puede modificar una vez creado el tipo (preserva el historial).
  </p>
</div>
```

(El area NO se manda como hidden porque el Server Action `actualizarTipoTarea` no la lee — ignora el campo.)

- [ ] **Step 2: Crear la page**

```tsx
// app/(app)/jefe/tareas/[id]/editar/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarTipo } from "./FormularioEditarTipo";

export const metadata: Metadata = { title: "Editar tipo de tarea" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarTipo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      frecuencia_dias_default: true,
      area: true,
      color: true,
      icono: true,
    },
  });

  if (!tipo) notFound();

  return (
    <FormularioEditarTipo
      tipo={{
        id: String(tipo.id),
        nombre: tipo.nombre,
        descripcion: tipo.descripcion ?? "",
        frecuencia_dias_default: tipo.frecuencia_dias_default,
        area: tipo.area,
        color: tipo.color ?? "",
        icono: tipo.icono ?? "",
      }}
    />
  );
}
```

- [ ] **Step 3: Build + lint**

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/tareas/[id]/editar/"
git commit -m "feat(tareas): pantalla y formulario editar tipo"
```

---

## Task 10: Frecuencias por lote

**Files:**
- Create: `app/(app)/jefe/lotes/[id]/frecuencias/page.tsx`
- Create: `app/(app)/jefe/lotes/[id]/frecuencias/FormularioFrecuencias.tsx`
- Create: `app/(app)/jefe/lotes/[id]/frecuencias/acciones.ts`

- [ ] **Step 1: Server Action `guardarFrecuencias`**

```ts
// app/(app)/jefe/lotes/[id]/frecuencias/acciones.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoFrecuencias = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function guardarFrecuencias(
  _prev: EstadoFrecuencias,
  formData: FormData,
): Promise<EstadoFrecuencias> {
  await requerirUsuario("JEFE");

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  if (!loteId) return { error: "ID de lote inválido." };

  // Esperamos campos del tipo `frec_<tipo_tarea_id>` con valor numérico o vacío.
  const tipos = await prisma.tipos_tarea.findMany({
    where: { area: "CULTIVO", activo: true },
    select: { id: true, frecuencia_dias_default: true },
  });

  const operaciones: Promise<unknown>[] = [];

  for (const t of tipos) {
    const raw = String(formData.get(`frec_${t.id}`) ?? "").trim();

    if (!raw) {
      // Vacío → borrar override si existía
      operaciones.push(
        prisma.frecuencias_lote.deleteMany({
          where: { lote_id: loteId, tipo_tarea_id: t.id },
        }),
      );
      continue;
    }

    if (!/^\d+$/.test(raw)) {
      return { error: `Frecuencia inválida en uno de los campos.` };
    }
    const valor = parseInt(raw, 10);
    if (valor <= 0) {
      return { error: `La frecuencia debe ser mayor a cero.` };
    }

    if (valor === t.frecuencia_dias_default) {
      // Igual al default → borrar override
      operaciones.push(
        prisma.frecuencias_lote.deleteMany({
          where: { lote_id: loteId, tipo_tarea_id: t.id },
        }),
      );
    } else {
      operaciones.push(
        prisma.frecuencias_lote.upsert({
          where: {
            lote_id_tipo_tarea_id: { lote_id: loteId, tipo_tarea_id: t.id },
          },
          update: { frecuencia_dias: valor },
          create: {
            lote_id: loteId,
            tipo_tarea_id: t.id,
            frecuencia_dias: valor,
          },
        }),
      );
    }
  }

  try {
    await prisma.$transaction(operaciones);
  } catch (e) {
    return { error: `No se pudo guardar: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath(`/jefe/lotes/${loteId}`);
  revalidatePath(`/jefe/lotes/${loteId}/frecuencias`);
  redirect(`/jefe/lotes/${loteId}`);
}
```

- [ ] **Step 2: Formulario cliente**

```tsx
// FormularioFrecuencias.tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { guardarFrecuencias, type EstadoFrecuencias } from "./acciones";

const ESTADO_INICIAL: EstadoFrecuencias = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

type Tipo = {
  id: string;
  nombre: string;
  frecuencia_dias_default: number;
  override: number | null;
};

export function FormularioFrecuencias({
  loteId,
  loteNombre,
  tipos,
}: {
  loteId: string;
  loteNombre: string;
  tipos: Tipo[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarFrecuencias, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="lote_id" value={loteId} />

      <Link
        href={`/jefe/lotes/${loteId}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {loteNombre}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Configuración
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Frecuencias por tipo
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Sobrescribe la frecuencia por defecto para este lote. Deja vacío para usar el default.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {tipos.map((t) => (
          <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label htmlFor={`frec_${t.id}`} className="block text-sm font-medium text-zelanda-verde-800">
                {t.nombre}
              </label>
              <p className="mt-0.5 text-xs text-zelanda-verde-700">
                Default: cada {t.frecuencia_dias_default} días
              </p>
            </div>
            <input
              id={`frec_${t.id}`}
              name={`frec_${t.id}`}
              type="number"
              min="1"
              step="1"
              defaultValue={t.override ?? ""}
              placeholder={String(t.frecuencia_dias_default)}
              className={`${inputBase} sm:w-32`}
            />
          </div>
        ))}
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
          href={`/jefe/lotes/${loteId}`}
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

- [ ] **Step 3: Page server**

```tsx
// page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioFrecuencias } from "./FormularioFrecuencias";

export const metadata: Metadata = { title: "Frecuencias del lote" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaFrecuencias({
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
    select: { id: true, nombre: true, deleted_at: true },
  });

  if (!lote || lote.deleted_at) notFound();

  const tipos = await prisma.tipos_tarea.findMany({
    where: { area: "CULTIVO", activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      frecuencia_dias_default: true,
      frecuencias_lote: {
        where: { lote_id: idBig },
        select: { frecuencia_dias: true },
        take: 1,
      },
    },
  });

  return (
    <FormularioFrecuencias
      loteId={String(lote.id)}
      loteNombre={lote.nombre}
      tipos={tipos.map((t) => ({
        id: String(t.id),
        nombre: t.nombre,
        frecuencia_dias_default: t.frecuencia_dias_default,
        override: t.frecuencias_lote[0]?.frecuencia_dias ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 4: Build + lint**

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/jefe/lotes/[id]/frecuencias/"
git commit -m "feat(lotes): frecuencias por lote (override del default)"
```

---

## Task 11: Helpers `lib/fechas-tarea.ts`

**Files:**
- Create: `lib/fechas-tarea.ts`

- [ ] **Step 1: Crear el helper**

```ts
// lib/fechas-tarea.ts
import "server-only";

export type EstadoAlerta = "aldia" | "proxima" | "vencida" | "sin_historial";

export type ResumenTarea = {
  ultima: Date | null;
  proxima: Date | null;
  estado: EstadoAlerta;
  dias_para_proxima: number | null;
};

const MS_DIA = 24 * 60 * 60 * 1000;

export function calcularResumen(
  ultimaCompletada: Date | null,
  frecuenciaDias: number,
  ahora: Date = new Date(),
): ResumenTarea {
  if (!ultimaCompletada) {
    return {
      ultima: null,
      proxima: null,
      estado: "sin_historial",
      dias_para_proxima: null,
    };
  }

  const proxima = new Date(ultimaCompletada.getTime() + frecuenciaDias * MS_DIA);
  const dias = Math.ceil((proxima.getTime() - ahora.getTime()) / MS_DIA);

  let estado: EstadoAlerta;
  if (dias <= 0) estado = "vencida";
  else if (dias <= 7) estado = "proxima";
  else estado = "aldia";

  return { ultima: ultimaCompletada, proxima, estado, dias_para_proxima: dias };
}

export function formatearDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 0) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}

export function etiquetaEstado(estado: EstadoAlerta): string {
  switch (estado) {
    case "aldia": return "Al día";
    case "proxima": return "Próxima";
    case "vencida": return "Vencida";
    case "sin_historial": return "Nunca hecho";
  }
}

export function tonoEstado(estado: EstadoAlerta): "aldia" | "proxima" | "vencida" | "neutro" {
  switch (estado) {
    case "aldia": return "aldia";
    case "proxima": return "proxima";
    case "vencida": return "vencida";
    case "sin_historial": return "vencida";
  }
}
```

- [ ] **Step 2: Build + lint**

- [ ] **Step 3: Commit**

```bash
git add lib/fechas-tarea.ts
git commit -m "feat(lib): helpers cálculo próxima fecha y estado de alerta"
```

---

## Task 12: Asignaciones — Server Actions

**Files:**
- Create: `app/(app)/jefe/asignaciones/acciones.ts`

- [ ] **Step 1: Crear las acciones**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoAsignacion = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function crearAsignacion(
  _prev: EstadoAsignacion,
  formData: FormData,
): Promise<EstadoAsignacion> {
  const usuario = await requerirUsuario("JEFE");

  const destino = String(formData.get("destino") ?? ""); // "lote" o "apiario"
  const loteIdRaw = formData.get("lote_id") ? String(formData.get("lote_id")) : null;
  const apiarioIdRaw = formData.get("apiario_id") ? String(formData.get("apiario_id")) : null;
  const tipoTareaId = parsearId(String(formData.get("tipo_tarea_id") ?? ""));
  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  const fechaInicioRaw = String(formData.get("fecha_inicio") ?? "").trim();

  if (destino !== "lote" && destino !== "apiario") {
    return { error: "Selecciona un destino (lote o apiario)." };
  }
  if (!tipoTareaId) return { error: "Selecciona un tipo de tarea." };
  if (!personaId) return { error: "Selecciona una persona." };

  const loteId = destino === "lote" ? parsearId(loteIdRaw) : null;
  const apiarioId = destino === "apiario" ? parsearId(apiarioIdRaw) : null;

  if (destino === "lote" && !loteId) return { error: "Selecciona un lote válido." };
  if (destino === "apiario" && !apiarioId) return { error: "Selecciona un apiario válido." };

  // Validar coherencia tipo.area vs destino
  const tipo = await prisma.tipos_tarea.findUnique({
    where: { id: tipoTareaId },
    select: { area: true, activo: true },
  });
  if (!tipo || !tipo.activo) return { error: "Tipo de tarea no válido o inactivo." };

  if (destino === "lote" && tipo.area !== "CULTIVO") {
    return { error: "Tipos de apicultura solo se asignan a apiarios." };
  }
  if (destino === "apiario" && tipo.area !== "APICULTURA") {
    return { error: "Tipos de cultivo solo se asignan a lotes." };
  }

  let fecha_inicio: Date | null = null;
  if (fechaInicioRaw) {
    const f = new Date(fechaInicioRaw);
    if (Number.isNaN(f.getTime())) {
      return { error: "Fecha de inicio inválida." };
    }
    fecha_inicio = f;
  }

  try {
    await prisma.asignaciones.create({
      data: {
        persona_id: personaId,
        lote_id: loteId,
        apiario_id: apiarioId,
        tipo_tarea_id: tipoTareaId,
        fecha_inicio: fecha_inicio ?? new Date(),
        estado: "PENDIENTE",
        creado_por_usuario_id: usuario.id,
      },
    });
  } catch (e) {
    return { error: `No se pudo crear: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath("/jefe/asignaciones");
  revalidatePath("/trabajador");
  redirect("/jefe/asignaciones");
}

export async function cancelarAsignacion(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: "CANCELADA" },
  });
  revalidatePath("/jefe/asignaciones");
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath("/trabajador");
}

export async function reabrirAsignacion(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!id) return;
  await prisma.asignaciones.update({
    where: { id },
    data: { estado: "EN_CURSO", fecha_completada: null },
  });
  revalidatePath("/jefe/asignaciones");
  revalidatePath(`/jefe/asignaciones/${id}`);
  revalidatePath("/trabajador");
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/asignaciones/acciones.ts"
git commit -m "feat(asignaciones): server actions crear/cancelar/reabrir"
```

---

## Task 13: Asignaciones — pantalla lista filtrable

**Files:**
- Create: `app/(app)/jefe/asignaciones/page.tsx`

- [ ] **Step 1: Crear la page**

Hereda searchParams para filtros (estado, persona_id, lote_id, apiario_id). Por defecto muestra PENDIENTE + EN_CURSO.

```tsx
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Asignaciones" };

type SearchParams = Promise<{ estado?: string }>;

export default async function PaginaAsignaciones({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;

  const filtroEstado = sp.estado;
  const where = filtroEstado
    ? filtroEstado === "abiertas"
      ? { estado: { in: ["PENDIENTE" as const, "EN_CURSO" as const] } }
      : filtroEstado === "todas"
        ? {}
        : { estado: filtroEstado as "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" }
    : { estado: { in: ["PENDIENTE" as const, "EN_CURSO" as const] } };

  const asignaciones = await prisma.asignaciones.findMany({
    where,
    orderBy: { fecha_inicio: "desc" },
    take: 100,
    include: {
      persona: { select: { nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
    },
  });

  // Apiarios separados (Prisma include nombre no es FK directo aquí porque apiario_id es nuevo)
  // Solución: enriquecer manualmente con los apiarios usados
  const apiarioIds = Array.from(
    new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
  );
  const apiarios = apiarioIds.length
    ? await prisma.apiarios.findMany({
        where: { id: { in: apiarioIds } },
        select: { id: true, nombre: true },
      })
    : [];
  const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a.nombre]));

  const opciones = [
    { value: "abiertas", label: "Abiertas" },
    { value: "PENDIENTE", label: "Pendientes" },
    { value: "EN_CURSO", label: "En curso" },
    { value: "COMPLETADA", label: "Completadas" },
    { value: "CANCELADA", label: "Canceladas" },
    { value: "todas", label: "Todas" },
  ];
  const filtroActual = filtroEstado ?? "abiertas";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Tareas
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Asignaciones
          </h1>
        </div>
        <Link
          href="/jefe/asignaciones/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3.5 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Link>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <Link
            key={o.value}
            href={`/jefe/asignaciones?estado=${o.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filtroActual === o.value
                ? "bg-zelanda-verde-700 text-zelanda-beige-50"
                : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      <ul className="space-y-2">
        {asignaciones.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No hay asignaciones con este filtro.
          </li>
        ) : (
          asignaciones.map((a) => {
            const destino = a.lote_id
              ? `Lote ${a.lotes!.nombre}`
              : `Apiario ${mapaApiario.get(String(a.apiario_id)) ?? "?"}`;
            const total = a.lotes?.total_arboles ?? null;
            return (
              <li
                key={String(a.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <Link
                  href={`/jefe/asignaciones/${a.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {a.tipos_tarea.nombre} · {destino}
                    </p>
                    <p className="truncate text-xs text-zelanda-verde-700">
                      {a.persona.nombre_completo} · inicio {formatearFechaCorta(a.fecha_inicio)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <BadgeBase tono={a.estado === "COMPLETADA" ? "info" : a.estado === "CANCELADA" ? "alerta" : "neutro"}>
                        {a.estado === "PENDIENTE" ? "Pendiente"
                         : a.estado === "EN_CURSO" ? "En curso"
                         : a.estado === "COMPLETADA" ? "Completada"
                         : "Cancelada"}
                      </BadgeBase>
                      {total !== null ? (
                        <span className="text-xs text-zelanda-verde-700">
                          {a.arboles_completados} / {total} árboles
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/asignaciones/page.tsx"
git commit -m "feat(asignaciones): pantalla lista filtrable"
```

---

## Task 14: Asignaciones — pantalla "Nueva asignación"

**Files:**
- Create: `app/(app)/jefe/asignaciones/nueva/page.tsx`
- Create: `app/(app)/jefe/asignaciones/nueva/FormularioNuevaAsignacion.tsx`

- [ ] **Step 1: Page server con datos para selectores**

```tsx
// page.tsx
import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioNuevaAsignacion } from "./FormularioNuevaAsignacion";

export const metadata: Metadata = { title: "Nueva asignación" };

type SearchParams = Promise<{
  lote_id?: string;
  apiario_id?: string;
  tipo_tarea_id?: string;
}>;

export default async function PaginaNuevaAsignacion({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;

  const [lotes, apiarios, tipos, personas] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.apiarios.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipos_tarea.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, area: true },
      orderBy: [{ area: "asc" }, { nombre: "asc" }],
    }),
    prisma.personas.findMany({
      where: {
        deleted_at: null,
        activo: true,
        vinculaciones: { some: { fecha_fin: null } },
      },
      select: { id: true, nombre_completo: true },
      orderBy: { nombre_completo: "asc" },
    }),
  ]);

  return (
    <FormularioNuevaAsignacion
      lotes={lotes.map((l) => ({ id: String(l.id), nombre: l.nombre }))}
      apiarios={apiarios.map((a) => ({ id: String(a.id), nombre: a.nombre }))}
      tipos={tipos.map((t) => ({ id: String(t.id), nombre: t.nombre, area: t.area }))}
      personas={personas.map((p) => ({ id: String(p.id), nombre_completo: p.nombre_completo }))}
      preselect={{
        lote_id: sp.lote_id ?? null,
        apiario_id: sp.apiario_id ?? null,
        tipo_tarea_id: sp.tipo_tarea_id ?? null,
      }}
    />
  );
}
```

- [ ] **Step 2: Formulario cliente**

```tsx
// FormularioNuevaAsignacion.tsx
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearAsignacion, type EstadoAsignacion } from "../acciones";

const ESTADO_INICIAL: EstadoAsignacion = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Opcion = { id: string; nombre: string };
type TipoOpcion = Opcion & { area: "CULTIVO" | "APICULTURA" };

export function FormularioNuevaAsignacion({
  lotes,
  apiarios,
  tipos,
  personas,
  preselect,
}: {
  lotes: Opcion[];
  apiarios: Opcion[];
  tipos: TipoOpcion[];
  personas: { id: string; nombre_completo: string }[];
  preselect: { lote_id: string | null; apiario_id: string | null; tipo_tarea_id: string | null };
}) {
  const [estado, accion, pendiente] = useActionState(crearAsignacion, ESTADO_INICIAL);
  const [destino, setDestino] = useState<"lote" | "apiario">(
    preselect.apiario_id ? "apiario" : "lote",
  );

  const tiposFiltrados = tipos.filter((t) =>
    destino === "lote" ? t.area === "CULTIVO" : t.area === "APICULTURA",
  );

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/asignaciones"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Asignaciones
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Crear
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva asignación
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div>
          <label className={labelBase}>Destino</label>
          <div className="mt-1.5 flex gap-2">
            <label className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${destino === "lote" ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900" : "border-zelanda-beige-300 text-zelanda-verde-700"}`}>
              <input
                type="radio"
                name="destino"
                value="lote"
                checked={destino === "lote"}
                onChange={() => setDestino("lote")}
                className="sr-only"
              />
              Lote
            </label>
            <label className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${destino === "apiario" ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900" : "border-zelanda-beige-300 text-zelanda-verde-700"}`}>
              <input
                type="radio"
                name="destino"
                value="apiario"
                checked={destino === "apiario"}
                onChange={() => setDestino("apiario")}
                className="sr-only"
              />
              Apiario
            </label>
          </div>
        </div>

        {destino === "lote" ? (
          <div>
            <label htmlFor="lote_id" className={labelBase}>Lote</label>
            <select
              id="lote_id"
              name="lote_id"
              required
              defaultValue={preselect.lote_id ?? ""}
              className={inputBase}
            >
              <option value="">Selecciona…</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="apiario_id" className={labelBase}>Apiario</label>
            <select
              id="apiario_id"
              name="apiario_id"
              required
              defaultValue={preselect.apiario_id ?? ""}
              className={inputBase}
            >
              <option value="">Selecciona…</option>
              {apiarios.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="tipo_tarea_id" className={labelBase}>Tipo de tarea</label>
          <select
            id="tipo_tarea_id"
            name="tipo_tarea_id"
            required
            defaultValue={preselect.tipo_tarea_id ?? ""}
            className={inputBase}
          >
            <option value="">Selecciona…</option>
            {tiposFiltrados.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="persona_id" className={labelBase}>Persona</label>
          <select id="persona_id" name="persona_id" required className={inputBase}>
            <option value="">Selecciona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fecha_inicio" className={labelBase}>Fecha de inicio</label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            defaultValue={hoy}
            className={inputBase}
          />
        </div>
      </section>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/jefe/asignaciones"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear asignación"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Build + lint + commit**

```bash
git add "app/(app)/jefe/asignaciones/nueva/"
git commit -m "feat(asignaciones): pantalla y formulario nueva asignación"
```

---

## Task 15: Asignaciones — pantalla detalle

**Files:**
- Create: `app/(app)/jefe/asignaciones/[id]/page.tsx`

- [ ] **Step 1: Page con historial de registros**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { cancelarAsignacion, reabrirAsignacion } from "../acciones";

export const metadata: Metadata = { title: "Asignación" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function formatearFechaHora(d: Date): string {
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function DetalleAsignacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      persona: { select: { nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
      registros_avance: {
        orderBy: { fecha_registro: "desc" },
        include: { persona: { select: { nombre_completo: true } } },
      },
    },
  });

  if (!a) notFound();

  let apiarioNombre: string | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true },
    });
    apiarioNombre = ap?.nombre ?? null;
  }

  const destino = a.lote_id
    ? { tipo: "lote" as const, nombre: a.lotes!.nombre, total: a.lotes!.total_arboles }
    : { tipo: "apiario" as const, nombre: apiarioNombre ?? "?", total: null };

  const abierta = a.estado === "PENDIENTE" || a.estado === "EN_CURSO";

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/asignaciones"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Asignaciones
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          {destino.tipo === "lote" ? "Lote" : "Apiario"} {destino.nombre}
        </p>
        <h1 className="mt-1 font-serif text-2xl leading-tight text-zelanda-verde-900">
          {a.tipos_tarea.nombre}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <BadgeBase tono={a.estado === "COMPLETADA" ? "info" : a.estado === "CANCELADA" ? "alerta" : "neutro"}>
            {a.estado}
          </BadgeBase>
          <span className="text-xs text-zelanda-verde-700">
            {a.persona.nombre_completo}
          </span>
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Información</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Fecha inicio</dt>
            <dd className="mt-0.5 text-zelanda-verde-900">{formatearFechaCorta(a.fecha_inicio)}</dd>
          </div>
          {a.fecha_completada ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Completada</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{formatearFechaCorta(a.fecha_completada)}</dd>
            </div>
          ) : null}
          {destino.total !== null ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Progreso</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {a.arboles_completados} / {destino.total} árboles
                ({destino.total > 0 ? Math.round((a.arboles_completados / destino.total) * 100) : 0}%)
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Historial de registros</h2>
        {a.registros_avance.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin registros aún.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {a.registros_avance.map((r) => (
              <li key={String(r.id)} className="border-l-2 border-zelanda-beige-300 pl-3">
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {r.tipo_registro}
                  {r.tipo_registro === "TRAMO" ? ` · árboles ${r.arbol_desde}–${r.arbol_hasta}` : ""}
                  {r.tipo_registro === "SUELTOS" ? ` · ${r.cantidad_arboles} árboles` : ""}
                </p>
                <p className="text-xs text-zelanda-verde-700">
                  {formatearFechaHora(r.fecha_registro)} · {r.persona.nombre_completo}
                </p>
                {r.observaciones ? (
                  <p className="mt-1 text-sm text-zelanda-verde-800">{r.observaciones}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        {abierta ? (
          <form action={cancelarAsignacion} className="flex-1">
            <input type="hidden" name="asignacion_id" value={String(a.id)} />
            <button
              type="submit"
              className="w-full rounded-lg border border-zelanda-beige-300 px-4 py-3 text-base font-medium text-estado-vencida transition hover:bg-zelanda-beige-100"
            >
              Cancelar asignación
            </button>
          </form>
        ) : a.estado === "COMPLETADA" ? (
          <form action={reabrirAsignacion} className="flex-1">
            <input type="hidden" name="asignacion_id" value={String(a.id)} />
            <button
              type="submit"
              className="w-full rounded-lg border border-zelanda-beige-300 px-4 py-3 text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
            >
              Reabrir
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/asignaciones/[id]/page.tsx"
git commit -m "feat(asignaciones): pantalla detalle con historial"
```

---

## Task 16: Avance — Server Action `registrarAvance`

**Files:**
- Create: `app/(app)/trabajador/avance/[asignacion_id]/acciones.ts`

- [ ] **Step 1: Crear el action**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

export type EstadoAvance = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function parsearListaNumeros(raw: string): number[] | null {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n <= 0) return null;
    nums.push(n);
  }
  return nums;
}

export async function registrarAvance(
  _prev: EstadoAvance,
  formData: FormData,
): Promise<EstadoAvance> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "Sesión no válida." };

  const asignacionId = parsearId(String(formData.get("asignacion_id") ?? ""));
  if (!asignacionId) return { error: "ID de asignación inválido." };

  const asignacion = await prisma.asignaciones.findUnique({
    where: { id: asignacionId },
    include: { lotes: { select: { total_arboles: true } } },
  });
  if (!asignacion) return { error: "Asignación no encontrada." };

  if (usuario.persona_id === null || BigInt(usuario.persona_id) !== asignacion.persona_id) {
    return { error: "No puedes registrar avance en una asignación que no es tuya." };
  }

  if (asignacion.estado !== "PENDIENTE" && asignacion.estado !== "EN_CURSO") {
    return { error: "Esta asignación ya está cerrada." };
  }

  const tipoRegistro = String(formData.get("tipo_registro") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (tipoRegistro === "VISITA") {
    if (asignacion.apiario_id === null) {
      return { error: "VISITA solo aplica a asignaciones de apiario." };
    }
    await prisma.$transaction([
      prisma.registros_avance.create({
        data: {
          asignacion_id: asignacionId,
          persona_id: BigInt(usuario.persona_id),
          tipo_registro: "VISITA",
          cantidad_arboles: 0,
          arboles_lista: [],
          observaciones,
        },
      }),
      prisma.asignaciones.update({
        where: { id: asignacionId },
        data: { estado: "COMPLETADA", fecha_completada: new Date() },
      }),
    ]);
    revalidatePath("/trabajador");
    revalidatePath(`/jefe/asignaciones/${asignacionId}`);
    redirect("/trabajador");
  }

  // CULTIVO: TRAMO o SUELTOS
  if (asignacion.lote_id === null) {
    return { error: "TRAMO/SUELTOS solo aplica a asignaciones de lote." };
  }
  const totalArboles = asignacion.lotes?.total_arboles ?? 0;
  if (totalArboles <= 0) {
    return { error: "El lote no tiene árboles cargados. Pídele al jefe que los cargue antes." };
  }

  let cantidad = 0;
  let arbol_desde: number | null = null;
  let arbol_hasta: number | null = null;
  let arboles_lista: number[] = [];

  if (tipoRegistro === "TRAMO") {
    const desdeRaw = String(formData.get("desde") ?? "").trim();
    const hastaRaw = String(formData.get("hasta") ?? "").trim();
    if (!/^\d+$/.test(desdeRaw) || !/^\d+$/.test(hastaRaw)) {
      return { error: "Desde y hasta deben ser enteros positivos." };
    }
    const d = parseInt(desdeRaw, 10);
    const h = parseInt(hastaRaw, 10);
    if (d < 1 || h < 1 || d > totalArboles || h > totalArboles) {
      return { error: `Los números deben estar entre 1 y ${totalArboles}.` };
    }
    if (d > h) return { error: "Desde no puede ser mayor que Hasta." };
    arbol_desde = d;
    arbol_hasta = h;
    cantidad = h - d + 1;
  } else if (tipoRegistro === "SUELTOS") {
    const listaRaw = String(formData.get("lista") ?? "").trim();
    const parsed = parsearListaNumeros(listaRaw);
    if (!parsed || parsed.length === 0) {
      return { error: "Lista de números inválida o vacía." };
    }
    const fueraDeRango = parsed.filter((n) => n > totalArboles);
    if (fueraDeRango.length > 0) {
      return { error: `Algunos números superan el total (${totalArboles}): ${fueraDeRango.slice(0, 5).join(", ")}` };
    }
    arboles_lista = parsed;
    cantidad = parsed.length;
  } else {
    return { error: "Tipo de registro inválido." };
  }

  const nuevoTotal = asignacion.arboles_completados + cantidad;
  const debeCompletar = nuevoTotal >= totalArboles;

  await prisma.$transaction([
    prisma.registros_avance.create({
      data: {
        asignacion_id: asignacionId,
        persona_id: BigInt(usuario.persona_id),
        tipo_registro: tipoRegistro === "TRAMO" ? "TRAMO" : "SUELTOS",
        arbol_desde,
        arbol_hasta,
        arboles_lista,
        cantidad_arboles: cantidad,
        observaciones,
      },
    }),
    prisma.asignaciones.update({
      where: { id: asignacionId },
      data: {
        arboles_completados: nuevoTotal,
        ultimo_arbol_trabajado: arbol_hasta !== null
          ? Math.max(asignacion.ultimo_arbol_trabajado, arbol_hasta)
          : asignacion.ultimo_arbol_trabajado,
        estado: debeCompletar ? "COMPLETADA" : "EN_CURSO",
        fecha_completada: debeCompletar ? new Date() : null,
      },
    }),
  ]);

  revalidatePath("/trabajador");
  revalidatePath(`/jefe/asignaciones/${asignacionId}`);
  redirect("/trabajador");
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/trabajador/avance/[asignacion_id]/acciones.ts"
git commit -m "feat(avance): server action registrarAvance (TRAMO/SUELTOS/VISITA)"
```

---

## Task 17: Avance — page + formulario (cultivo y apicultura)

**Files:**
- Create: `app/(app)/trabajador/avance/[asignacion_id]/page.tsx`
- Create: `app/(app)/trabajador/avance/[asignacion_id]/FormAvance.tsx`

- [ ] **Step 1: Page server**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormAvance } from "./FormAvance";

export const metadata: Metadata = { title: "Registrar avance" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaAvance({
  params,
}: {
  params: Promise<{ asignacion_id: string }>;
}) {
  const usuario = await requerirUsuario();
  const { asignacion_id } = await params;
  const idBig = parsearId(asignacion_id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
    },
  });

  if (!a) notFound();
  if (usuario.persona_id === null || BigInt(usuario.persona_id) !== a.persona_id) notFound();
  if (a.estado !== "PENDIENTE" && a.estado !== "EN_CURSO") notFound();

  let apiarioNombre: string | null = null;
  let totalColmenas: number | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true, total_colmenas: true },
    });
    apiarioNombre = ap?.nombre ?? null;
    totalColmenas = ap?.total_colmenas ?? null;
  }

  return (
    <FormAvance
      asignacion={{
        id: String(a.id),
        tipoTarea: a.tipos_tarea.nombre,
        area: a.tipos_tarea.area,
        loteNombre: a.lotes?.nombre ?? null,
        totalArboles: a.lotes?.total_arboles ?? null,
        arbolesCompletados: a.arboles_completados,
        ultimoArbolTrabajado: a.ultimo_arbol_trabajado,
        apiarioNombre,
        totalColmenas,
      }}
    />
  );
}
```

- [ ] **Step 2: Formulario cliente con tabs TRAMO/SUELTOS o VISITA**

```tsx
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { registrarAvance, type EstadoAvance } from "./acciones";

const ESTADO_INICIAL: EstadoAvance = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Asignacion = {
  id: string;
  tipoTarea: string;
  area: "CULTIVO" | "APICULTURA";
  loteNombre: string | null;
  totalArboles: number | null;
  arbolesCompletados: number;
  ultimoArbolTrabajado: number;
  apiarioNombre: string | null;
  totalColmenas: number | null;
};

export function FormAvance({ asignacion }: { asignacion: Asignacion }) {
  const [estado, accion, pendiente] = useActionState(registrarAvance, ESTADO_INICIAL);
  const esCultivo = asignacion.area === "CULTIVO";
  const [tipo, setTipo] = useState<"TRAMO" | "SUELTOS">("TRAMO");

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="asignacion_id" value={asignacion.id} />

      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis tareas
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          {esCultivo ? `Lote ${asignacion.loteNombre}` : `Apiario ${asignacion.apiarioNombre}`}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {asignacion.tipoTarea}
        </h1>
        {esCultivo && asignacion.totalArboles !== null ? (
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Progreso: {asignacion.arbolesCompletados} / {asignacion.totalArboles} árboles
            {asignacion.ultimoArbolTrabajado > 0 ? (
              <> · último: árbol {asignacion.ultimoArbolTrabajado}</>
            ) : null}
          </p>
        ) : null}
      </header>

      {esCultivo ? (
        <>
          <input type="hidden" name="tipo_registro" value={tipo} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("TRAMO")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "TRAMO"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Tramo
            </button>
            <button
              type="button"
              onClick={() => setTipo("SUELTOS")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                tipo === "SUELTOS"
                  ? "border-zelanda-verde-600 bg-zelanda-verde-50 text-zelanda-verde-900"
                  : "border-zelanda-beige-300 text-zelanda-verde-700"
              }`}
            >
              Sueltos
            </button>
          </div>

          <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
            {tipo === "TRAMO" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="desde" className={labelBase}>Desde árbol</label>
                  <input id="desde" name="desde" type="number" min="1" required className={inputBase} />
                </div>
                <div>
                  <label htmlFor="hasta" className={labelBase}>Hasta árbol</label>
                  <input id="hasta" name="hasta" type="number" min="1" required className={inputBase} />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="lista" className={labelBase}>
                  Números de árboles (separados por coma o espacio)
                </label>
                <textarea
                  id="lista"
                  name="lista"
                  rows={3}
                  required
                  placeholder="12, 45, 67, 89"
                  className={`${inputBase} min-h-[80px] resize-y`}
                />
              </div>
            )}

            <div>
              <label htmlFor="observaciones" className={labelBase}>Notas (opcional)</label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={2}
                className={`${inputBase} min-h-[60px] resize-y`}
              />
            </div>
          </section>
        </>
      ) : (
        <>
          <input type="hidden" name="tipo_registro" value="VISITA" />
          <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
            {asignacion.totalColmenas !== null ? (
              <p className="text-sm text-zelanda-verde-700">
                {asignacion.totalColmenas} colmenas registradas.
              </p>
            ) : null}
            <div>
              <label htmlFor="observaciones" className={labelBase}>
                Observaciones (qué se hizo, hallazgos, kg de miel, etc.)
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={4}
                required
                className={`${inputBase} min-h-[100px] resize-y`}
              />
            </div>
            <p className="text-xs text-zelanda-verde-700">
              Al registrar, la asignación queda completada.
            </p>
          </section>
        </>
      )}

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
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Build + lint + commit**

```bash
git add "app/(app)/trabajador/avance/"
git commit -m "feat(avance): pantalla y formulario registrar avance"
```

---

## Task 18: Trabajador — home rediseñada

**Files:**
- Modify: `app/(app)/trabajador/page.tsx`

- [ ] **Step 1: Reescribir el archivo**

```tsx
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";

export const metadata = { title: "Mis tareas" };

export default async function PaginaInicioTrabajador() {
  const usuario = await requerirUsuario("TRABAJADOR");

  const asignaciones = usuario.persona_id
    ? await prisma.asignaciones.findMany({
        where: {
          persona_id: BigInt(usuario.persona_id),
          estado: { in: ["PENDIENTE", "EN_CURSO"] },
        },
        orderBy: { fecha_inicio: "asc" },
        include: {
          tipos_tarea: { select: { nombre: true, area: true } },
          lotes: { select: { nombre: true, total_arboles: true } },
        },
      })
    : [];

  const apiarioIds = Array.from(
    new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
  );
  const apiarios = apiarioIds.length
    ? await prisma.apiarios.findMany({
        where: { id: { in: apiarioIds } },
        select: { id: true, nombre: true, total_colmenas: true },
      })
    : [];
  const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a]));

  return (
    <div className="space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Trabajador
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Mis tareas activas <span className="text-sm text-zelanda-verde-700">({asignaciones.length})</span>
        </h2>

        {asignaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No tienes tareas asignadas en este momento.
          </p>
        ) : (
          <ul className="space-y-2">
            {asignaciones.map((a) => {
              const apiario = a.apiario_id ? mapaApiario.get(String(a.apiario_id)) : null;
              const destino = a.lote_id
                ? `Lote ${a.lotes!.nombre}`
                : `Apiario ${apiario?.nombre ?? "?"}`;
              const total = a.lote_id ? a.lotes?.total_arboles ?? 0 : (apiario?.total_colmenas ?? 0);
              const labelDetalle = a.lote_id
                ? `${a.arboles_completados} / ${total} árboles`
                : `${total} colmenas`;
              const accion = a.estado === "EN_CURSO" ? "Continuar" : "Empezar";

              return (
                <li
                  key={String(a.id)}
                  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
                >
                  <Link href={`/trabajador/avance/${a.id}`} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zelanda-verde-900">
                        {a.tipos_tarea.nombre}
                      </p>
                      <p className="text-xs text-zelanda-verde-700">
                        {destino} · {labelDetalle}
                      </p>
                      <div className="mt-1.5">
                        <BadgeBase tono={a.estado === "EN_CURSO" ? "info" : "neutro"}>
                          {a.estado === "EN_CURSO" ? "En curso" : "Pendiente"}
                        </BadgeBase>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm font-medium text-zelanda-beige-50">
                      {accion}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-screen-md px-4 pb-2">
        <Link
          href="/trabajador/novedad/nueva"
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-zelanda-ocre-600 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-card transition hover:bg-zelanda-ocre-700"
        >
          <Plus className="h-5 w-5" />
          Reportar novedad
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/trabajador/page.tsx"
git commit -m "feat(trabajador): home con lista de tareas y botón reportar novedad"
```

---

## Task 19: Novedad — Server Action `crearNovedad`

**Files:**
- Create: `app/(app)/trabajador/novedad/nueva/acciones.ts`

- [ ] **Step 1: Crear el action con upload de foto opcional**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { subirFoto } from "@/lib/supabase/storage";

export type EstadoNovedad = { error: string | null };

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function esTipoNovedadValido(v: string): v is "PLAGA" | "DANO_FISICO" | "ENFERMEDAD" | "OBSERVACION" | "OTRO" {
  return v === "PLAGA" || v === "DANO_FISICO" || v === "ENFERMEDAD" || v === "OBSERVACION" || v === "OTRO";
}

export async function crearNovedad(
  _prev: EstadoNovedad,
  formData: FormData,
): Promise<EstadoNovedad> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.persona_id === null) {
    return { error: "Sesión no válida o sin persona vinculada." };
  }

  const loteId = parsearId(String(formData.get("lote_id") ?? ""));
  const numeroPlaca = String(formData.get("numero_placa") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const foto = formData.get("foto");

  if (!loteId) return { error: "Selecciona un lote." };
  if (!/^\d+$/.test(numeroPlaca)) {
    return { error: "Número de árbol inválido." };
  }
  const placa = parseInt(numeroPlaca, 10);
  if (placa < 1) return { error: "Número de árbol inválido." };
  if (!esTipoNovedadValido(tipoRaw)) return { error: "Tipo de novedad inválido." };
  if (!descripcion) return { error: "La descripción es obligatoria." };

  // Buscar el árbol exacto
  const arbol = await prisma.arboles.findFirst({
    where: { lote_id: loteId, numero_placa: placa, deleted_at: null },
    select: { id: true },
  });
  if (!arbol) {
    return { error: `No existe el árbol ${placa} en ese lote. ¿Ya cargó el jefe los árboles?` };
  }

  let foto_path: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const res = await subirFoto(foto, "novedades");
    if ("error" in res) {
      // Continuar sin foto y avisar implícitamente — para no bloquear la captura del problema
      foto_path = null;
    } else {
      foto_path = res.path;
    }
  }

  try {
    await prisma.novedades.create({
      data: {
        arbol_id: arbol.id,
        persona_id: BigInt(usuario.persona_id),
        tipo: tipoRaw,
        descripcion,
        foto_path,
        resuelta: false,
      },
    });
  } catch (e) {
    return { error: `No se pudo guardar: ${(e as Error)?.message ?? "desconocido"}.` };
  }

  revalidatePath("/trabajador");
  revalidatePath("/jefe");
  revalidatePath("/jefe/novedades");
  redirect("/trabajador");
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/trabajador/novedad/nueva/acciones.ts"
git commit -m "feat(novedades): server action crearNovedad con upload foto opcional"
```

---

## Task 20: Novedad — page + formulario

**Files:**
- Create: `app/(app)/trabajador/novedad/nueva/page.tsx`
- Create: `app/(app)/trabajador/novedad/nueva/FormularioNovedad.tsx`

- [ ] **Step 1: Page server**

```tsx
import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioNovedad } from "./FormularioNovedad";

export const metadata: Metadata = { title: "Reportar novedad" };

export default async function PaginaNuevaNovedad() {
  await requerirUsuario();

  const lotes = await prisma.lotes.findMany({
    where: { deleted_at: null, total_arboles: { gt: 0 } },
    select: { id: true, nombre: true, total_arboles: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <FormularioNovedad
      lotes={lotes.map((l) => ({
        id: String(l.id),
        nombre: l.nombre,
        totalArboles: l.total_arboles,
      }))}
    />
  );
}
```

- [ ] **Step 2: Formulario cliente con SubirFoto**

```tsx
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
```

- [ ] **Step 3: Build + lint + commit**

```bash
git add "app/(app)/trabajador/novedad/"
git commit -m "feat(novedades): pantalla y formulario reportar novedad"
```

---

## Task 21: Novedades — pantalla lista del jefe

**Files:**
- Create: `app/(app)/jefe/novedades/page.tsx`

- [ ] **Step 1: Crear la page con filtro default resuelta=false**

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Novedades" };

type SearchParams = Promise<{ resueltas?: string }>;

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function PaginaNovedades({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;
  const verResueltas = sp.resueltas === "si";

  const novedades = await prisma.novedades.findMany({
    where: { resuelta: verResueltas },
    orderBy: { fecha: "desc" },
    take: 100,
    include: {
      arboles: {
        select: {
          numero_placa: true,
          lotes: { select: { nombre: true } },
        },
      },
      persona: { select: { nombre_completo: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Reportes de campo
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Novedades
        </h1>
      </header>

      <nav className="flex gap-1.5">
        <Link
          href="/jefe/novedades"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            !verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Pendientes
        </Link>
        <Link
          href="/jefe/novedades?resueltas=si"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            verResueltas
              ? "bg-zelanda-verde-700 text-zelanda-beige-50"
              : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
          }`}
        >
          Resueltas
        </Link>
      </nav>

      <ul className="space-y-2">
        {novedades.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            {verResueltas ? "No hay novedades resueltas." : "No hay novedades pendientes."}
          </li>
        ) : (
          novedades.map((n) => (
            <li key={String(n.id)} className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
              <Link href={`/jefe/novedades/${n.id}`} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
                    <span className="text-xs text-zelanda-verde-700">
                      {formatearFechaCorta(n.fecha)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zelanda-verde-900">
                    Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
                  </p>
                  <p className="truncate text-xs text-zelanda-verde-700">
                    {n.descripcion}
                  </p>
                  <p className="mt-0.5 text-xs text-zelanda-verde-700/80">
                    por {n.persona.nombre_completo}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/novedades/page.tsx"
git commit -m "feat(novedades): pantalla lista con filtro pendientes/resueltas"
```

---

## Task 22: Novedades — detalle + marcar resuelta

**Files:**
- Create: `app/(app)/jefe/novedades/[id]/page.tsx`
- Create: `app/(app)/jefe/novedades/[id]/acciones.ts`

- [ ] **Step 1: Server Action `marcarResuelta`**

```ts
// acciones.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function marcarResuelta(formData: FormData) {
  await requerirUsuario("JEFE");
  const id = parsearId(String(formData.get("novedad_id") ?? ""));
  if (!id) return;

  await prisma.novedades.update({
    where: { id },
    data: { resuelta: true, fecha_resolucion: new Date() },
  });

  revalidatePath("/jefe/novedades");
  revalidatePath("/jefe");
  redirect("/jefe/novedades");
}
```

- [ ] **Step 2: Page detalle con foto firmada**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFotoFirmada } from "@/lib/supabase/storage";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { marcarResuelta } from "./acciones";

export const metadata: Metadata = { title: "Novedad" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function DetalleNovedad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const n = await prisma.novedades.findUnique({
    where: { id: idBig },
    include: {
      arboles: {
        select: {
          numero_placa: true,
          lotes: { select: { id: true, nombre: true } },
        },
      },
      persona: { select: { nombre_completo: true } },
    },
  });

  if (!n) notFound();

  const urlFoto = n.foto_path ? await urlFotoFirmada(n.foto_path) : null;

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/novedades"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Novedades
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
          {n.resuelta ? (
            <BadgeBase tono="info">Resuelta</BadgeBase>
          ) : null}
          <span className="text-xs text-zelanda-verde-700">
            {formatearFechaCorta(n.fecha)}
          </span>
        </div>
        <h1 className="mt-2 font-serif text-2xl text-zelanda-verde-900">
          Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Reportada por {n.persona.nombre_completo}
        </p>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Descripción</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zelanda-verde-800">
          {n.descripcion}
        </p>
      </section>

      {urlFoto ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-card">
          <Image
            src={urlFoto}
            alt="Foto de la novedad"
            width={800}
            height={600}
            className="h-auto w-full rounded-lg object-cover"
            unoptimized
          />
        </section>
      ) : null}

      {n.resuelta ? (
        <p className="text-xs text-zelanda-verde-700">
          Resuelta el {formatearFechaCorta(n.fecha_resolucion!)}.
        </p>
      ) : (
        <form action={marcarResuelta}>
          <input type="hidden" name="novedad_id" value={String(n.id)} />
          <button
            type="submit"
            className="w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
          >
            Marcar resuelta
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build + lint + commit**

```bash
git add "app/(app)/jefe/novedades/[id]/"
git commit -m "feat(novedades): pantalla detalle con foto y marcar resuelta"
```

---

## Task 23: Dashboard `/jefe` rediseñado

**Files:**
- Modify: `app/(app)/jefe/page.tsx`

- [ ] **Step 1: Reescribir la home del jefe**

```tsx
import Link from "next/link";
import { AlertTriangle, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { calcularResumen, formatearDias } from "@/lib/fechas-tarea";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Panel del jefe" };

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario("JEFE");

  // 1. Última asignación COMPLETADA por (lote, tipo) — solo CULTIVO
  const completadasLote = await prisma.asignaciones.groupBy({
    by: ["lote_id", "tipo_tarea_id"],
    where: { estado: "COMPLETADA", lote_id: { not: null } },
    _max: { fecha_completada: true },
  });

  // 2. Cargar lotes activos con sus frecuencias override
  const [lotes, tiposCultivo, frecuenciasOverride] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: "CULTIVO", activo: true },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.frecuencias_lote.findMany({
      select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
    }),
  ]);

  const mapaFreq = new Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }

  const mapaUltimaLote = new Map<string, Date | null>();
  for (const c of completadasLote) {
    if (c.lote_id) {
      mapaUltimaLote.set(`${c.lote_id}_${c.tipo_tarea_id}`, c._max.fecha_completada);
    }
  }

  // Generar matriz (lote × tipo)
  type FilaAlerta = {
    loteNombre: string;
    loteId: string;
    tipoNombre: string;
    tipoId: string;
    dias_para_proxima: number | null;
    estado: "aldia" | "proxima" | "vencida" | "sin_historial";
  };

  const filas: FilaAlerta[] = [];
  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const resumen = calcularResumen(ultima, freq);
      filas.push({
        loteNombre: l.nombre,
        loteId: String(l.id),
        tipoNombre: t.nombre,
        tipoId: String(t.id),
        dias_para_proxima: resumen.dias_para_proxima,
        estado: resumen.estado,
      });
    }
  }

  const vencidas = filas
    .filter((f) => f.estado === "vencida" || f.estado === "sin_historial")
    .sort((a, b) => (a.dias_para_proxima ?? -Infinity) - (b.dias_para_proxima ?? -Infinity))
    .slice(0, 10);

  const proximas = filas
    .filter((f) => f.estado === "proxima")
    .sort((a, b) => (a.dias_para_proxima ?? 0) - (b.dias_para_proxima ?? 0))
    .slice(0, 10);

  const novedadesPendientes = await prisma.novedades.findMany({
    where: { resuelta: false },
    orderBy: { fecha: "desc" },
    take: 5,
    include: {
      arboles: {
        select: { numero_placa: true, lotes: { select: { nombre: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Panel del jefe
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      {/* Vencidas */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <AlertTriangle className="h-4 w-4 text-estado-vencida" />
          Vencidas <span className="text-sm font-normal text-zelanda-verde-700">({vencidas.length})</span>
        </h2>
        {vencidas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Todo al día por ahora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {vencidas.map((f) => (
              <li key={`${f.loteId}_${f.tipoId}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.loteId}&tipo_tarea_id=${f.tipoId}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipoNombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.loteNombre}</span>
                  </span>
                  <span className="text-xs text-estado-vencida">
                    {f.estado === "sin_historial" ? "nunca hecho" : `vencida ${formatearDias(f.dias_para_proxima)}`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Próximas */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Clock className="h-4 w-4 text-estado-proxima" />
          Próximas (7 días) <span className="text-sm font-normal text-zelanda-verde-700">({proximas.length})</span>
        </h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin tareas próximas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximas.map((f) => (
              <li key={`${f.loteId}_${f.tipoId}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.loteId}&tipo_tarea_id=${f.tipoId}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipoNombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.loteNombre}</span>
                  </span>
                  <span className="text-xs text-estado-proxima">{formatearDias(f.dias_para_proxima)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Novedades */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <AlertCircle className="h-4 w-4 text-zelanda-ocre-600" />
            Novedades sin resolver
          </h2>
          <Link href="/jefe/novedades" className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900">
            Ver todas
          </Link>
        </div>
        {novedadesPendientes.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin novedades pendientes.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedadesPendientes.map((n) => (
              <li key={String(n.id)}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
                  <span className="flex-1 truncate text-zelanda-verde-900">
                    Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
                  </span>
                  <span className="text-xs text-zelanda-verde-700">{formatearFechaCorta(n.fecha)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/page.tsx"
git commit -m "feat(jefe): dashboard con alertas y novedades"
```

---

## Task 24: Sección "Tareas y estado" en detalle de lote

**Files:**
- Modify: `app/(app)/jefe/lotes/[id]/page.tsx`

- [ ] **Step 1: Agregar imports y query de tareas**

En el archivo actual, agregar después de la query del lote:

```tsx
import { calcularResumen, formatearDias, etiquetaEstado, tonoEstado } from "@/lib/fechas-tarea";
import { BadgeBase } from "@/components/shared/BadgeRol";

// … dentro del default export, después de obtener el lote:

const [tiposCultivo, asignacionesCompletadas, frecuenciasOverride] = await Promise.all([
  prisma.tipos_tarea.findMany({
    where: { area: "CULTIVO", activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, frecuencia_dias_default: true },
  }),
  prisma.asignaciones.findMany({
    where: { lote_id: idBig, estado: "COMPLETADA" },
    orderBy: { fecha_completada: "desc" },
    select: { tipo_tarea_id: true, fecha_completada: true },
  }),
  prisma.frecuencias_lote.findMany({
    where: { lote_id: idBig },
    select: { tipo_tarea_id: true, frecuencia_dias: true },
  }),
]);

const mapaUltima = new Map<string, Date | null>();
for (const c of asignacionesCompletadas) {
  const key = String(c.tipo_tarea_id);
  if (!mapaUltima.has(key)) mapaUltima.set(key, c.fecha_completada);
}

const mapaFreq = new Map<string, number>();
for (const f of frecuenciasOverride) {
  mapaFreq.set(String(f.tipo_tarea_id), f.frecuencia_dias);
}

const filasTarea = tiposCultivo.map((t) => {
  const ultima = mapaUltima.get(String(t.id)) ?? null;
  const freq = mapaFreq.get(String(t.id)) ?? t.frecuencia_dias_default;
  const resumen = calcularResumen(ultima, freq);
  return { id: String(t.id), nombre: t.nombre, ...resumen };
});

const novedadesLote = await prisma.novedades.findMany({
  where: { arboles: { lote_id: idBig }, resuelta: false },
  orderBy: { fecha: "desc" },
  take: 5,
  include: { arboles: { select: { numero_placa: true } } },
});
```

- [ ] **Step 2: Reemplazar sección "Tareas" placeholder por la real**

Reemplazar el bloque actual:

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Tareas
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Las asignaciones a este lote aparecerán aquí en la Fase 3.
        </p>
      </section>
```

por:

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Tareas y estado
          </h2>
          <Link
            href={`/jefe/lotes/${lote.id}/frecuencias`}
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Frecuencias
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-zelanda-beige-200">
          {filasTarea.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zelanda-verde-900">{f.nombre}</p>
                <p className="text-xs text-zelanda-verde-700">
                  {f.ultima
                    ? `Última: ${f.ultima.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · próxima ${formatearDias(f.dias_para_proxima)}`
                    : "Sin historial"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BadgeBase tono={tonoEstado(f.estado) as "aldia" | "proxima" | "vencida" | "neutro"}>
                  {etiquetaEstado(f.estado)}
                </BadgeBase>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${lote.id}&tipo_tarea_id=${f.id}`}
                  className="text-xs font-medium text-zelanda-verde-700 hover:text-zelanda-verde-900"
                >
                  Asignar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
```

- [ ] **Step 3: Reemplazar sección "Árboles" placeholder por "Novedades del lote"**

Reemplazar:

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Árboles
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Los árboles del lote se cargarán junto con el polígono cuando se
          capturen las coordenadas en campo.
        </p>
      </section>
```

por:

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Novedades pendientes
          </h2>
          <Link
            href="/jefe/novedades"
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Ver todas
          </Link>
        </div>
        {novedadesLote.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            No hay novedades pendientes en este lote.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedadesLote.map((n) => (
              <li key={String(n.id)}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="block rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="font-medium text-zelanda-verde-900">Árbol {n.arboles.numero_placa}</span>
                  <span className="text-zelanda-verde-700"> · {n.tipo.replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
```

- [ ] **Step 4: Build + lint + commit**

```bash
git add "app/(app)/jefe/lotes/[id]/page.tsx"
git commit -m "feat(lotes): detalle muestra tareas/estado y novedades pendientes"
```

---

## Task 25: Sección "Tareas y estado" en detalle de apiario

**Files:**
- Modify: `app/(app)/jefe/apiarios/[id]/page.tsx`

- [ ] **Step 1: Agregar query y sección similar al lote pero con tipos APICULTURA**

Replicar la lógica de Task 24 con dos diferencias:
1. Query `tipos_tarea` filtra `area = APICULTURA` en vez de CULTIVO.
2. Query `asignacionesCompletadas` filtra `apiario_id = idBig` en vez de `lote_id`.
3. NO se hace query a `frecuencias_lote` (apiarios usan solo default global).
4. La sección "Asignar" linkea a `?apiario_id=${idStr}&tipo_tarea_id=${f.id}`.
5. No hay sección de novedades (las novedades son por árbol, no por apiario).

Reemplazar la sección actual placeholder "Visitas y cosechas de miel":

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Visitas y cosechas de miel
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zelanda-verde-700">
          Las tareas de visita al apiario y las cosechas de miel aparecerán
          aquí en la Fase 3.
        </p>
      </section>
```

por el bloque equivalente a "Tareas y estado" (sin frecuencias y sin novedades). El bloque completo a insertar:

```tsx
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Tareas y estado
        </h2>
        <ul className="mt-3 divide-y divide-zelanda-beige-200">
          {filasTarea.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zelanda-verde-900">{f.nombre}</p>
                <p className="text-xs text-zelanda-verde-700">
                  {f.ultima
                    ? `Última: ${f.ultima.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · próxima ${formatearDias(f.dias_para_proxima)}`
                    : "Sin historial"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BadgeBase tono={tonoEstado(f.estado) as "aldia" | "proxima" | "vencida" | "neutro"}>
                  {etiquetaEstado(f.estado)}
                </BadgeBase>
                <Link
                  href={`/jefe/asignaciones/nueva?apiario_id=${idStr}&tipo_tarea_id=${f.id}`}
                  className="text-xs font-medium text-zelanda-verde-700 hover:text-zelanda-verde-900"
                >
                  Asignar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
```

Queries a agregar antes del return (después de obtener `apiario`):

```tsx
import { calcularResumen, formatearDias, etiquetaEstado, tonoEstado } from "@/lib/fechas-tarea";

const [tiposApicultura, completadas] = await Promise.all([
  prisma.tipos_tarea.findMany({
    where: { area: "APICULTURA", activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, frecuencia_dias_default: true },
  }),
  prisma.asignaciones.findMany({
    where: { apiario_id: idBig, estado: "COMPLETADA" },
    orderBy: { fecha_completada: "desc" },
    select: { tipo_tarea_id: true, fecha_completada: true },
  }),
]);

const mapaUltima = new Map<string, Date | null>();
for (const c of completadas) {
  const key = String(c.tipo_tarea_id);
  if (!mapaUltima.has(key)) mapaUltima.set(key, c.fecha_completada);
}

const filasTarea = tiposApicultura.map((t) => {
  const ultima = mapaUltima.get(String(t.id)) ?? null;
  const resumen = calcularResumen(ultima, t.frecuencia_dias_default);
  return { id: String(t.id), nombre: t.nombre, ...resumen };
});
```

- [ ] **Step 2: Build + lint + commit**

```bash
git add "app/(app)/jefe/apiarios/[id]/page.tsx"
git commit -m "feat(apiarios): detalle muestra tareas/estado"
```

---

## Task 26: Bottom nav del jefe — agregar "Tareas"

**Files:**
- Modify: `components/shared/BottomNav.tsx`

- [ ] **Step 1: Inspeccionar el archivo actual**

```bash
cat components/shared/BottomNav.tsx
```

(Es probable que tenga un array de items por rol. Agregar el ítem "Tareas" → `/jefe/asignaciones` con icono `ListChecks` de lucide.)

- [ ] **Step 2: Aplicar el cambio**

En la sección que define los items del rol JEFE, agregar:

```tsx
{ href: "/jefe/asignaciones", label: "Tareas", icono: ListChecks },
```

(El ítem queda entre "Lotes" y "Equipo".)

Importar `ListChecks` de `lucide-react`.

- [ ] **Step 3: Build + lint + commit**

```bash
git add "components/shared/BottomNav.tsx"
git commit -m "feat(nav): agregar Tareas al bottom nav del jefe"
```

---

## Task 27: Verificación integral, smoke test y push

- [ ] **Step 1: Build limpio**

```bash
npm run build
```

Expected: PASS sin errores. Verificar que aparecen las rutas nuevas:
- `/jefe`
- `/jefe/tareas` + `/nuevo` + `/[id]/editar`
- `/jefe/asignaciones` + `/nueva` + `/[id]`
- `/jefe/novedades` + `/[id]`
- `/jefe/lotes/[id]/frecuencias`
- `/trabajador`
- `/trabajador/avance/[asignacion_id]`
- `/trabajador/novedad/nueva`

- [ ] **Step 2: Lint limpio**

```bash
npm run lint
```

- [ ] **Step 3: Smoke test manual**

Iniciar `npm run dev`. Como jefe:

1. `/jefe` → dashboard con secciones vencidas/próximas/novedades vacías.
2. `/jefe/tareas` → ver 8 tipos seedeados. Editar "Plateo químico" cambiando frecuencia a 100. Confirmar.
3. Crear nuevo tipo "Test" CULTIVO, frecuencia 30. Desactivarlo.
4. `/jefe/lotes/Armenia` → editar → poner `total_arboles = 100` → guardar. Mensaje verde "Se generaron 100 árboles".
5. Volver a `/jefe/lotes/Armenia` → ver sección "Tareas y estado" con todas las filas mostrando "Sin historial / Nunca hecho".
6. `/jefe/lotes/Armenia/frecuencias` → poner 60 en "Plateo químico", guardar. Confirmar que el detalle del lote muestra 60 en próxima.
7. Crear asignación: Diego, Armenia, Plateo químico, hoy. Confirmar que aparece en `/jefe/asignaciones`.
8. Logout. Login como Diego. `/trabajador` → ver la asignación "Plateo químico · Lote Armenia · 0/100 árboles".
9. Tap → `/trabajador/avance/X` → TRAMO, desde 1, hasta 50, guardar. Vuelve a home, ahora dice "50/100".
10. Tap → SUELTOS, lista "51, 52, 53, 54, 55, 56, 57, 58, 59, 60" → guardar. Ahora "60/100".
11. TRAMO 61-100 → guardar. Asignación pasa a COMPLETADA, desaparece de mis tareas.
12. Tap "Reportar novedad" → seleccionar Armenia, árbol 42, PLAGA, "manchas anaranjadas", subir foto (si tienes). Reportar.
13. Logout. Login como jefe. `/jefe` → dashboard muestra "Novedad PLAGA · Árbol 42 · Lote Armenia". Tap → ver detalle con foto.
14. Marcar resuelta. Desaparece del dashboard.
15. Crear asignación: Diego, apiario El Cedro, Visita al apiario, hoy.
16. Logout, login como Diego, tap → form VISITA → "Revisé las 12 colmenas, todo bien" + foto opcional → completar. Pasa a COMPLETADA.

- [ ] **Step 4: Push a main**

Si todo OK:

```bash
git push origin main
```

Vercel auto-deploya. Verificar URLs en https://zelanda.vercel.app.

- [ ] **Step 5: Actualizar memoria del proyecto**

Actualizar `C:\Users\samue\.claude\projects\d--Zelanda\memory\project_fincapp.md` cambiando "Estado actual" para reflejar Fase 3 completa: ciclo operativo (tareas, asignaciones cultivo+apicultura, avance TRAMO/SUELTOS/VISITA, novedades con foto, dashboard de alertas) desplegado.

---

## Self-review del plan

**1. Spec coverage:**

| Spec módulo | Tasks |
|---|---|
| Schema migration | 1 |
| Storage + componente foto | 2, 3 |
| Carga de árboles | 4, 5 |
| Catálogo tipos | 6, 7, 8, 9 |
| Frecuencias por lote | 10 |
| Helpers fechas | 11 |
| Asignaciones | 12, 13, 14, 15 |
| Avance trabajador | 16, 17 |
| Home trabajador | 18 |
| Novedades reporte | 19, 20 |
| Novedades jefe (lista + detalle) | 21, 22 |
| Dashboard jefe | 23 |
| Tareas/estado en detalle lote | 24 |
| Tareas/estado en detalle apiario | 25 |
| Bottom nav | 26 |
| Verificación | 27 |

Cobertura completa. ✓

**2. Placeholder scan:**
- Sin "TBD"/"TODO"/"Similar to" sin código.
- Steps con código completo en server actions y forms críticos.
- Algunos steps describen patrones (Task 9 dice "mismo patrón que Task 8 pero..."). Es aceptable porque el subagente ve los archivos de las tasks anteriores creados en su carpeta del repo y replica con las variaciones especificadas.

**3. Type consistency:**
- `EstadoTipoTarea`, `EstadoAsignacion`, `EstadoAvance`, `EstadoNovedad`, `EstadoFrecuencias`, `EstadoEdicionLote` — todos `{ error: string | null }` salvo `EstadoEdicionLote` que extiende con `aviso` y `EstadoPerfil` (preexistente) con `exito`. Consistencia OK.
- `crearTipoTarea`, `actualizarTipoTarea`, `cambiarEstadoTipo` (Task 6) → usados en Tasks 7, 8, 9 con esos nombres exactos.
- `crearAsignacion`, `cancelarAsignacion`, `reabrirAsignacion` (Task 12) → usados en Tasks 13, 14, 15 con esos nombres.
- `registrarAvance` (Task 16) → usado en Task 17.
- `crearNovedad` (Task 19) → usado en Task 20.
- `marcarResuelta` (Task 22) → usado en Task 22.
- `guardarFrecuencias` (Task 10) → usado en Task 10.
- `calcularResumen`, `formatearDias`, `etiquetaEstado`, `tonoEstado` (Task 11) → usados en Tasks 23, 24, 25.
- `subirFoto`, `urlFotoFirmada` (Task 2) → usados en Tasks 19, 22.
- `SubirFoto` (Task 3) → usado en Task 20.
- `EstadoAlerta = "aldia" | "proxima" | "vencida" | "sin_historial"` (Task 11) — los Badge usan `tono="aldia" | "proxima" | "vencida" | "neutro"`. Función `tonoEstado` mapea `sin_historial → vencida`. ✓

Cero gaps detectados.
