# Fase 4 — Bodega y Almacén Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de inventario de la finca: bodega (despachos+devoluciones+stock) y almacén (cosechas+salidas), con vistas de lectura para el jefe.

**Architecture:** Server Components + Server Actions (Next.js 15 App Router). Mismo patrón que Fase 3. Una sola migración SQL (`despachos.asignacion_id` opcional). Aprovecha 7 tablas + 2 vistas ya existentes.

**Tech Stack:** Next.js 15.5, React 19 (`useActionState`), Prisma 6.19, Supabase, Tailwind v3, Lucide.

**Spec:** `docs/superpowers/specs/2026-05-15-fase4-bodega-almacen-design.md`

**Convenciones (repetir en todas las tareas):**
- Idioma español en todo: UI, código, commits, errores.
- Sin emojis en UI.
- `min-h-touch` (44px) en botones e inputs.
- Tipos `Decimal` de Prisma se serializan vía `.toString()` o `Number()` antes de pasar a Client Components.
- `BigInt` se serializa con `.toString()` antes de pasar al cliente.
- Server actions devuelven `EstadoEdicion = { error: string | null }` (excepto las que redirigen).
- Form action pattern: `useActionState` con estado inicial `{ error: null }`.
- Header de páginas con `<header>` clase del estilo Zelanda + texto `text-zelanda-verde-700/900`.

---

## Task 1: Migración SQL + sync de Prisma

**Files:**
- Create: `supabase/migracion-fase4-bodega-almacen.sql`
- Modify: `prisma/schema.prisma` (agregar `asignacion_id` y relación en `despachos`)
- Modify: `esquema.sql` (mantener fuente local consistente)

- [ ] **Step 1: Crear el SQL de migración (idempotente)**

`supabase/migracion-fase4-bodega-almacen.sql`:
```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'despachos' AND column_name = 'asignacion_id'
  ) THEN
    ALTER TABLE despachos
      ADD COLUMN asignacion_id BIGINT REFERENCES asignaciones(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_despachos_asignacion ON despachos(asignacion_id);

COMMIT;
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Manual: abrir Supabase SQL Editor del proyecto `gyburlhzvisgmdmfkqhx`, pegar el contenido del archivo y ejecutar. Verificar mensaje "Success".

- [ ] **Step 3: Actualizar `prisma/schema.prisma`**

En el modelo `despachos`, agregar `asignacion_id` y la relación inversa:

```prisma
model despachos {
  id                        BigInt           @id @default(autoincrement())
  persona_id                BigInt
  despachado_por_usuario_id String           @db.Uuid
  estado                    estado_despacho  @default(ABIERTO)
  fecha                     DateTime         @default(now()) @db.Timestamptz(6)
  fecha_devolucion          DateTime?        @db.Timestamptz(6)
  notas                     String?
  asignacion_id             BigInt?
  despacho_items            despacho_items[]
  usuarios                  usuarios         @relation(fields: [despachado_por_usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  persona                   personas         @relation(fields: [persona_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  asignacion                asignaciones?    @relation(fields: [asignacion_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([persona_id, estado], map: "idx_despachos_persona_estado")
  @@index([asignacion_id], map: "idx_despachos_asignacion")
  @@schema("public")
}
```

En el modelo `asignaciones`, agregar la relación inversa:

```prisma
  despachos              despachos[]
```

(Justo después de `registros_avance       registros_avance[]`.)

- [ ] **Step 4: Generar cliente Prisma**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client".

- [ ] **Step 5: Reflejar en `esquema.sql`**

Cerca de la definición de `despachos` (línea ~211), agregar al final del CREATE TABLE:
```sql
  asignacion_id               BIGINT REFERENCES asignaciones(id),
```
y agregar después del CREATE INDEX:
```sql
CREATE INDEX idx_despachos_asignacion ON despachos(asignacion_id);
```

- [ ] **Step 6: Verificar typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS (sin errores).

- [ ] **Step 7: Commit**

```bash
git add supabase/migracion-fase4-bodega-almacen.sql prisma/schema.prisma esquema.sql
git commit -m "feat(fase4): migracion asignacion_id en despachos"
```

---

## Task 2: Inicio bodega `/bodega` (placeholder → real)

**Files:**
- Modify: `app/(app)/bodega/page.tsx`

Reemplaza el placeholder por dashboard con 3 tarjetas:

- **Despachos abiertos** (count + link).
- **Stock bajo** (lista de insumos con `por_debajo_minimo = TRUE`, máximo 5).
- **Cerrados hoy** (count).

- [ ] **Step 1: Reemplazar el archivo**

`app/(app)/bodega/page.tsx`:
```tsx
import Link from "next/link";
import { AlertTriangle, PackageOpen, CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Bodega" };

export default async function PaginaInicioBodega() {
  const usuario = await requerirUsuario("BODEGA");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [abiertos, cerradosHoy, stockBajo] = await Promise.all([
    prisma.despachos.count({ where: { estado: "ABIERTO" } }),
    prisma.despachos.count({
      where: { estado: "CERRADO", fecha_devolucion: { gte: inicioDia } },
    }),
    prisma.$queryRaw<
      { id: bigint; nombre: string; unidad: string; stock_disponible: string }[]
    >`
      SELECT id, nombre, unidad, stock_disponible::text
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
      ORDER BY nombre
      LIMIT 5
    `,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenido, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/bodega/despachos"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card transition hover:border-zelanda-verde-300"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <PackageOpen className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Despachos abiertos</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {abiertos}
          </p>
        </Link>

        <Link
          href="/bodega/inventario"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card transition hover:border-zelanda-verde-300"
        >
          <div className="flex items-center gap-2 text-estado-vencida">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Stock bajo</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {stockBajo.length}
          </p>
        </Link>

        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <CheckCircle2 className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Cerrados hoy</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {cerradosHoy}
          </p>
        </div>
      </div>

      {stockBajo.length > 0 && (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Insumos por debajo del mínimo
          </h2>
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {stockBajo.map((i) => (
              <li
                key={i.id.toString()}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-zelanda-verde-900">{i.nombre}</span>
                <span className="text-estado-vencida">
                  {i.stock_disponible} {i.unidad}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```
Expected: ruta `/bodega` compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/bodega/page.tsx
git commit -m "feat(bodega): inicio con metricas de despachos y stock"
```

---

## Task 3: Inventario bodega `/bodega/inventario` — listado herramientas + insumos

**Files:**
- Create: `app/(app)/bodega/inventario/page.tsx`

Muestra dos secciones (herramientas e insumos) en cards. Cada fila lista atributos clave y botones de acción (editar, toggle activo). Para insumos: link de "Ingresar stock" por fila.

- [ ] **Step 1: Crear archivo**

`app/(app)/bodega/inventario/page.tsx`:
```tsx
import Link from "next/link";
import { Plus, Wrench, FlaskConical, PackagePlus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ToggleActivoHerramienta, ToggleActivoInsumo } from "./toggles";

export const metadata = { title: "Inventario" };

export default async function PaginaInventario() {
  await requerirUsuario("BODEGA");

  const [herramientas, insumos] = await Promise.all([
    prisma.herramientas.findMany({ orderBy: { nombre: "asc" } }),
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        categoria: string;
        unidad: string;
        stock_actual: string;
        stock_reservado: string;
        stock_disponible: string;
        stock_minimo: string;
        por_debajo_minimo: boolean;
        activo: boolean;
      }[]
    >`
      SELECT
        id, nombre, categoria::text, unidad,
        stock_actual::text, stock_reservado::text,
        stock_disponible::text, stock_minimo::text,
        por_debajo_minimo, activo
      FROM v_insumos_stock
      ORDER BY nombre
    `,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Inventario
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <Wrench className="h-5 w-5" /> Herramientas
          </h2>
          <Link
            href="/bodega/inventario/herramientas/nueva"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Nueva
          </Link>
        </div>

        {herramientas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay herramientas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {herramientas.map((h) => (
              <li
                key={h.id.toString()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/bodega/inventario/herramientas/${h.id}/editar`}
                    className={`block truncate font-medium ${
                      h.activo ? "text-zelanda-verde-900" : "text-zelanda-verde-700/50"
                    }`}
                  >
                    {h.nombre}
                  </Link>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {h.categoria} · Total {h.total}
                  </p>
                </div>
                <ToggleActivoHerramienta id={h.id.toString()} activo={h.activo} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <FlaskConical className="h-5 w-5" /> Insumos
          </h2>
          <Link
            href="/bodega/inventario/insumos/nuevo"
            className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" /> Nuevo
          </Link>
        </div>

        {insumos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay insumos registrados.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {insumos.map((i) => (
              <li
                key={i.id.toString()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/bodega/inventario/insumos/${i.id}/editar`}
                    className={`block truncate font-medium ${
                      i.activo ? "text-zelanda-verde-900" : "text-zelanda-verde-700/50"
                    }`}
                  >
                    {i.nombre}
                  </Link>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {i.categoria} · {i.stock_disponible} {i.unidad} disponible
                    {i.por_debajo_minimo && (
                      <span className="ml-2 rounded bg-estado-vencida/10 px-1.5 py-0.5 text-estado-vencida">
                        bajo mín
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/bodega/inventario/insumos/${i.id}/ingresar`}
                    className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1.5 text-xs text-zelanda-verde-700"
                  >
                    <PackagePlus className="h-4 w-4" /> Ingresar
                  </Link>
                  <ToggleActivoInsumo id={i.id.toString()} activo={i.activo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Crear el componente cliente de toggles**

`app/(app)/bodega/inventario/toggles.tsx`:
```tsx
"use client";

import { cambiarEstadoHerramienta, cambiarEstadoInsumo } from "./acciones";

export function ToggleActivoHerramienta({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  return (
    <form action={cambiarEstadoHerramienta}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={String(!activo)} />
      <button
        type="submit"
        className={`min-h-touch rounded-lg px-3 text-xs ${
          activo
            ? "border border-zelanda-verde-700 text-zelanda-verde-700"
            : "bg-zelanda-verde-700 text-white"
        }`}
      >
        {activo ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}

export function ToggleActivoInsumo({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  return (
    <form action={cambiarEstadoInsumo}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activar" value={String(!activo)} />
      <button
        type="submit"
        className={`min-h-touch rounded-lg px-3 text-xs ${
          activo
            ? "border border-zelanda-verde-700 text-zelanda-verde-700"
            : "bg-zelanda-verde-700 text-white"
        }`}
      >
        {activo ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```
Expected: la ruta `/bodega/inventario` compila (las acciones aún no existen, pero los toggles las importan — necesitamos crearlas en el siguiente paso o agregar stubs).

**Nota:** este step va a fallar si `acciones.ts` no existe todavía. La Task 4 lo crea. Combinar commit hasta Task 4.

---

## Task 4: Acciones de inventario (CRUD herramientas + insumos)

**Files:**
- Create: `app/(app)/bodega/inventario/acciones.ts`

Acciones:
- `crearHerramienta(_prev, formData)` → redirect /bodega/inventario
- `actualizarHerramienta(_prev, formData)` → redirect
- `cambiarEstadoHerramienta(formData)` → revalidate
- `crearInsumo(_prev, formData)` → redirect
- `actualizarInsumo(_prev, formData)` → redirect
- `cambiarEstadoInsumo(formData)` → revalidate

Validaciones clave: nombre único (manejar UNIQUE de BD), categoría válida, no desactivar si hay despachos abiertos con ese item.

- [ ] **Step 1: Crear el archivo**

`app/(app)/bodega/inventario/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };
const ESTADO_INICIAL: EstadoEdicion = { error: null };

type CategoriaItem = "CULTIVO" | "COSECHA" | "APICULTURA";

function esCategoriaValida(v: string): v is CategoriaItem {
  return v === "CULTIVO" || v === "COSECHA" || v === "APICULTURA";
}

// ============= HERRAMIENTAS =============

export async function crearHerramienta(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const totalRaw = String(formData.get("total") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Selecciona una categoría válida." };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: "El total debe ser un entero mayor o igual a cero." };
  }

  try {
    await prisma.herramientas.create({
      data: { nombre, categoria: categoriaRaw, total, activo: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe una herramienta con ese nombre." };
    }
    return { error: `No se pudo crear: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function actualizarHerramienta(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "ID inválido." };
  const id = BigInt(idRaw);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const totalRaw = String(formData.get("total") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Categoría inválida." };
  }
  const total = Number(totalRaw);
  if (!Number.isInteger(total) || total < 0) {
    return { error: "El total debe ser un entero ≥ 0." };
  }

  try {
    await prisma.herramientas.update({
      where: { id },
      data: { nombre, categoria: categoriaRaw, total },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe una herramienta con ese nombre." };
    }
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function cambiarEstadoHerramienta(formData: FormData) {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";
  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        herramienta_id: id,
        despachos: { estado: "ABIERTO" },
      },
      select: { id: true },
    });
    if (enUso) {
      // Silenciosamente no la desactivamos. La UI ya muestra el estado.
      // En una iteración futura podríamos retornar mensaje via cookie/flash.
      return;
    }
  }

  await prisma.herramientas.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath("/bodega/inventario");
}

// ============= INSUMOS =============

export async function crearInsumo(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const unidad = String(formData.get("unidad") ?? "").trim();
  const stockMinRaw = String(formData.get("stock_minimo") ?? "").trim();
  const costoRaw = String(formData.get("costo_unitario") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) {
    return { error: "Categoría inválida." };
  }
  if (!unidad) return { error: "La unidad es obligatoria (ej: L, kg, unidades)." };

  const stockMin = Number(stockMinRaw || "0");
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: "Stock mínimo debe ser ≥ 0." };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Costo unitario debe ser un número positivo." };
    }
    costo = c;
  }

  try {
    await prisma.insumos.create({
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
        activo: true,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe un insumo con ese nombre." };
    }
    return { error: `No se pudo crear: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function actualizarInsumo(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "ID inválido." };
  const id = BigInt(idRaw);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaRaw = String(formData.get("categoria") ?? "");
  const unidad = String(formData.get("unidad") ?? "").trim();
  const stockMinRaw = String(formData.get("stock_minimo") ?? "").trim();
  const costoRaw = String(formData.get("costo_unitario") ?? "").trim();

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!esCategoriaValida(categoriaRaw)) return { error: "Categoría inválida." };
  if (!unidad) return { error: "Unidad obligatoria." };

  const stockMin = Number(stockMinRaw || "0");
  if (!Number.isFinite(stockMin) || stockMin < 0) {
    return { error: "Stock mínimo ≥ 0." };
  }

  let costo: number | null = null;
  if (costoRaw) {
    const c = Number(costoRaw);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Costo unitario debe ser positivo." };
    }
    costo = c;
  }

  try {
    await prisma.insumos.update({
      where: { id },
      data: {
        nombre,
        categoria: categoriaRaw,
        unidad,
        stock_minimo: stockMin,
        costo_unitario: costo,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Ya existe un insumo con ese nombre." };
    }
    return { error: `No se pudo actualizar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}

export async function cambiarEstadoInsumo(formData: FormData) {
  await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";
  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  if (!activar) {
    const enUso = await prisma.despacho_items.findFirst({
      where: {
        insumo_id: id,
        despachos: { estado: "ABIERTO" },
      },
      select: { id: true },
    });
    if (enUso) return;
  }

  await prisma.insumos.update({
    where: { id },
    data: { activo: activar },
  });
  revalidatePath("/bodega/inventario");
}

// ============= INGRESO DE STOCK =============

export async function ingresarStock(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const idRaw = String(formData.get("insumo_id") ?? "");
  if (!/^\d+$/.test(idRaw)) return { error: "Insumo inválido." };
  const insumoId = BigInt(idRaw);

  const cantidadRaw = String(formData.get("cantidad") ?? "").trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Cantidad debe ser un número positivo." };
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  try {
    await prisma.$transaction([
      prisma.insumos.update({
        where: { id: insumoId },
        data: { stock_actual: { increment: cantidad } },
      }),
      prisma.movimientos_insumo.create({
        data: {
          insumo_id: insumoId,
          tipo: "INGRESO",
          cantidad: cantidad,
          usuario_id: usuario.id,
          notas,
        },
      }),
    ]);
  } catch (e) {
    return { error: `Error al ingresar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/inventario");
  redirect("/bodega/inventario");
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```
Expected: la ruta `/bodega/inventario` compila ahora con sus toggles, pero las rutas hijas (nueva, editar, ingresar) aún no existen — eso es OK, no son referenciadas desde el build hasta que el usuario las visite.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/bodega/inventario/page.tsx app/(app)/bodega/inventario/toggles.tsx app/(app)/bodega/inventario/acciones.ts
git commit -m "feat(bodega): inventario con listado herramientas e insumos"
```

---

## Task 5: Formularios crear/editar herramienta

**Files:**
- Create: `app/(app)/bodega/inventario/herramientas/nueva/page.tsx`
- Create: `app/(app)/bodega/inventario/herramientas/[id]/editar/page.tsx`
- Create: `app/(app)/bodega/inventario/herramientas/_formulario.tsx`

- [ ] **Step 1: Componente cliente del formulario**

`app/(app)/bodega/inventario/herramientas/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import {
  crearHerramienta,
  actualizarHerramienta,
  type EstadoEdicion,
} from "../../acciones";

type Valores = {
  id?: string;
  nombre: string;
  categoria: "CULTIVO" | "COSECHA" | "APICULTURA";
  total: number;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioHerramienta({
  modo,
  valores,
}: {
  modo: "crear" | "editar";
  valores?: Valores;
}) {
  const accion = modo === "crear" ? crearHerramienta : actualizarHerramienta;
  const [estado, formAction, pending] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-4">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          name="nombre"
          required
          defaultValue={valores?.nombre ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Categoría
        </label>
        <select
          name="categoria"
          required
          defaultValue={valores?.categoria ?? "CULTIVO"}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="CULTIVO">Cultivo</option>
          <option value="COSECHA">Cosecha</option>
          <option value="APICULTURA">Apicultura</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Total disponible
        </label>
        <input
          name="total"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={valores?.total ?? 0}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : modo === "crear" ? "Crear" : "Guardar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Página "Nueva herramienta"**

`app/(app)/bodega/inventario/herramientas/nueva/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { FormularioHerramienta } from "../_formulario";

export const metadata = { title: "Nueva herramienta" };

export default async function PaginaNuevaHerramienta() {
  await requerirUsuario("BODEGA");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva herramienta
        </h1>
      </header>
      <FormularioHerramienta modo="crear" />
    </div>
  );
}
```

- [ ] **Step 3: Página "Editar herramienta"**

`app/(app)/bodega/inventario/herramientas/[id]/editar/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioHerramienta } from "../../_formulario";

export const metadata = { title: "Editar herramienta" };

export default async function PaginaEditarHerramienta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const h = await prisma.herramientas.findUnique({ where: { id: BigInt(id) } });
  if (!h) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Editar herramienta
        </h1>
      </header>
      <FormularioHerramienta
        modo="editar"
        valores={{
          id: h.id.toString(),
          nombre: h.nombre,
          categoria: h.categoria,
          total: h.total,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/bodega/inventario/herramientas"
git commit -m "feat(bodega): crear y editar herramientas"
```

---

## Task 6: Formularios crear/editar insumo + ingreso de stock

**Files:**
- Create: `app/(app)/bodega/inventario/insumos/_formulario.tsx`
- Create: `app/(app)/bodega/inventario/insumos/nuevo/page.tsx`
- Create: `app/(app)/bodega/inventario/insumos/[id]/editar/page.tsx`
- Create: `app/(app)/bodega/inventario/insumos/[id]/ingresar/page.tsx`

- [ ] **Step 1: Componente de formulario insumo**

`app/(app)/bodega/inventario/insumos/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import {
  crearInsumo,
  actualizarInsumo,
  type EstadoEdicion,
} from "../../acciones";

type Valores = {
  id?: string;
  nombre: string;
  categoria: "CULTIVO" | "COSECHA" | "APICULTURA";
  unidad: string;
  stock_minimo: string;
  costo_unitario: string | null;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioInsumo({
  modo,
  valores,
}: {
  modo: "crear" | "editar";
  valores?: Valores;
}) {
  const accion = modo === "crear" ? crearInsumo : actualizarInsumo;
  const [estado, formAction, pending] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-4">
      {valores?.id && <input type="hidden" name="id" value={valores.id} />}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Nombre
        </label>
        <input
          name="nombre"
          required
          defaultValue={valores?.nombre ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Categoría
        </label>
        <select
          name="categoria"
          required
          defaultValue={valores?.categoria ?? "CULTIVO"}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="CULTIVO">Cultivo</option>
          <option value="COSECHA">Cosecha</option>
          <option value="APICULTURA">Apicultura</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Unidad
        </label>
        <input
          name="unidad"
          required
          placeholder="L, kg, unidades, m..."
          defaultValue={valores?.unidad ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Stock mínimo
        </label>
        <input
          name="stock_minimo"
          type="number"
          min="0"
          step="0.001"
          required
          defaultValue={valores?.stock_minimo ?? "0"}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Costo unitario (opcional)
        </label>
        <input
          name="costo_unitario"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={valores?.costo_unitario ?? ""}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : modo === "crear" ? "Crear" : "Guardar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Página "Nuevo insumo"**

`app/(app)/bodega/inventario/insumos/nuevo/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { FormularioInsumo } from "../_formulario";

export const metadata = { title: "Nuevo insumo" };

export default async function PaginaNuevoInsumo() {
  await requerirUsuario("BODEGA");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo insumo
        </h1>
      </header>
      <FormularioInsumo modo="crear" />
    </div>
  );
}
```

- [ ] **Step 3: Página "Editar insumo"**

`app/(app)/bodega/inventario/insumos/[id]/editar/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioInsumo } from "../../_formulario";

export const metadata = { title: "Editar insumo" };

export default async function PaginaEditarInsumo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const i = await prisma.insumos.findUnique({ where: { id: BigInt(id) } });
  if (!i) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Editar insumo
        </h1>
      </header>
      <FormularioInsumo
        modo="editar"
        valores={{
          id: i.id.toString(),
          nombre: i.nombre,
          categoria: i.categoria,
          unidad: i.unidad,
          stock_minimo: i.stock_minimo.toString(),
          costo_unitario: i.costo_unitario?.toString() ?? null,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Página "Ingresar stock"**

`app/(app)/bodega/inventario/insumos/[id]/ingresar/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioIngresoStock } from "./_formulario";

export const metadata = { title: "Ingresar stock" };

export default async function PaginaIngresarStock({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const insumo = await prisma.insumos.findUnique({ where: { id: BigInt(id) } });
  if (!insumo) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Ingresar stock
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {insumo.nombre} ({insumo.unidad})
        </p>
      </header>
      <FormularioIngresoStock
        insumoId={insumo.id.toString()}
        unidad={insumo.unidad}
      />
    </div>
  );
}
```

`app/(app)/bodega/inventario/insumos/[id]/ingresar/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { ingresarStock, type EstadoEdicion } from "../../../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioIngresoStock({
  insumoId,
  unidad,
}: {
  insumoId: string;
  unidad: string;
}) {
  const [estado, formAction, pending] = useActionState(
    ingresarStock,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="insumo_id" value={insumoId} />

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad ({unidad})
        </label>
        <input
          name="cantidad"
          type="number"
          min="0.001"
          step="0.001"
          required
          autoFocus
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={3}
          placeholder="ej: compra del 12/05 a CampoFuerte"
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar ingreso"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add "app/(app)/bodega/inventario/insumos"
git commit -m "feat(bodega): insumos crear, editar e ingresar stock"
```

---

## Task 7: Lista de despachos `/bodega/despachos`

**Files:**
- Create: `app/(app)/bodega/despachos/page.tsx`

Muestra despachos en dos secciones: ABIERTOS arriba, CERRADOS HOY abajo.

- [ ] **Step 1: Crear**

`app/(app)/bodega/despachos/page.tsx`:
```tsx
import Link from "next/link";
import { Plus, PackageOpen, CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Despachos" };

export default async function PaginaDespachos() {
  await requerirUsuario("BODEGA");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [abiertos, cerradosHoy] = await Promise.all([
    prisma.despachos.findMany({
      where: { estado: "ABIERTO" },
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
    prisma.despachos.findMany({
      where: {
        estado: "CERRADO",
        fecha_devolucion: { gte: inicioDia },
      },
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha_devolucion: "desc" },
    }),
  ]);

  const fmtHora = (d: Date) =>
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Bodega
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Despachos
          </h1>
        </div>
        <Link
          href="/bodega/despachos/nuevo"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <PackageOpen className="h-5 w-5" /> Abiertos ({abiertos.length})
        </h2>
        {abiertos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            No hay despachos abiertos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {abiertos.map((d) => (
              <li key={d.id.toString()}>
                <Link
                  href={`/bodega/despachos/${d.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {d.persona.nombre_completo}
                    </p>
                    <p className="text-xs text-zelanda-verde-700/70">
                      {fmtHora(d.fecha)} · {d._count.despacho_items} item(s)
                    </p>
                  </div>
                  <span className="text-xs text-zelanda-verde-700">Cerrar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <CheckCircle2 className="h-5 w-5" /> Cerrados hoy ({cerradosHoy.length})
        </h2>
        {cerradosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no se han cerrado despachos hoy.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cerradosHoy.map((d) => (
              <li key={d.id.toString()} className="py-3 text-sm">
                <p className="font-medium text-zelanda-verde-900">
                  {d.persona.nombre_completo}
                </p>
                <p className="text-xs text-zelanda-verde-700/70">
                  {fmtHora(d.fecha)} → {d.fecha_devolucion && fmtHora(d.fecha_devolucion)} · {d._count.despacho_items} item(s)
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add app/(app)/bodega/despachos/page.tsx
git commit -m "feat(bodega): lista despachos abiertos y cerrados del dia"
```

---

## Task 8: Crear despacho — acción + pantalla

**Files:**
- Create: `app/(app)/bodega/despachos/acciones.ts`
- Create: `app/(app)/bodega/despachos/nuevo/page.tsx`
- Create: `app/(app)/bodega/despachos/nuevo/_formulario.tsx`

La acción `crearDespacho` recibe `items` como JSON serializado, valida stock, y hace inserts en transacción.

- [ ] **Step 1: Crear acciones**

`app/(app)/bodega/despachos/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };
const ESTADO_INICIAL: EstadoEdicion = { error: null };

type ItemInput = {
  tipo: "HERRAMIENTA" | "INSUMO";
  ref_id: string;
  cantidad: string;
};

export async function crearDespacho(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const personaIdRaw = String(formData.get("persona_id") ?? "");
  if (!/^\d+$/.test(personaIdRaw)) return { error: "Persona inválida." };
  const personaId = BigInt(personaIdRaw);

  const asignacionIdRaw = String(formData.get("asignacion_id") ?? "").trim();
  let asignacionId: bigint | null = null;
  if (asignacionIdRaw && /^\d+$/.test(asignacionIdRaw)) {
    asignacionId = BigInt(asignacionIdRaw);
  }

  const itemsRaw = String(formData.get("items") ?? "[]");
  let items: ItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Formato de items inválido." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Agrega al menos un item al despacho." };
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  // Validar items
  for (const it of items) {
    if (it.tipo !== "HERRAMIENTA" && it.tipo !== "INSUMO") {
      return { error: "Tipo de item inválido." };
    }
    if (!/^\d+$/.test(it.ref_id)) {
      return { error: "Referencia de item inválida." };
    }
    const c = Number(it.cantidad);
    if (!Number.isFinite(c) || c <= 0) {
      return { error: "Cantidad inválida en uno de los items." };
    }
  }

  // Verificar stock de insumos
  const insumosNecesarios = new Map<string, number>();
  for (const it of items) {
    if (it.tipo === "INSUMO") {
      insumosNecesarios.set(
        it.ref_id,
        (insumosNecesarios.get(it.ref_id) ?? 0) + Number(it.cantidad),
      );
    }
  }

  for (const [refId, cantidad] of insumosNecesarios) {
    const stock = await prisma.$queryRaw<
      { stock_disponible: string; nombre: string; unidad: string }[]
    >`
      SELECT stock_disponible::text, nombre, unidad
      FROM v_insumos_stock
      WHERE id = ${BigInt(refId)}
    `;
    if (stock.length === 0) {
      return { error: "Insumo inexistente." };
    }
    const disponible = Number(stock[0].stock_disponible);
    if (disponible < cantidad) {
      return {
        error: `Stock insuficiente de ${stock[0].nombre} (disponible: ${disponible} ${stock[0].unidad}, pedido: ${cantidad})`,
      };
    }
  }

  // Transacción
  try {
    await prisma.$transaction(async (tx) => {
      const despacho = await tx.despachos.create({
        data: {
          persona_id: personaId,
          asignacion_id: asignacionId,
          despachado_por_usuario_id: usuario.id,
          estado: "ABIERTO",
          notas,
        },
      });

      for (const it of items) {
        const cantidad = Number(it.cantidad);
        const itemCreado = await tx.despacho_items.create({
          data: {
            despacho_id: despacho.id,
            tipo_item: it.tipo,
            herramienta_id:
              it.tipo === "HERRAMIENTA" ? BigInt(it.ref_id) : null,
            insumo_id: it.tipo === "INSUMO" ? BigInt(it.ref_id) : null,
            cantidad,
          },
        });

        if (it.tipo === "INSUMO") {
          await tx.insumos.update({
            where: { id: BigInt(it.ref_id) },
            data: { stock_reservado: { increment: cantidad } },
          });
          await tx.movimientos_insumo.create({
            data: {
              insumo_id: BigInt(it.ref_id),
              tipo: "RESERVA",
              cantidad: -cantidad,
              despacho_item_id: itemCreado.id,
              usuario_id: usuario.id,
            },
          });
        }
      }
    });
  } catch (e) {
    return {
      error: `No se pudo crear el despacho: ${(e as Error)?.message ?? "desconocido"}`,
    };
  }

  revalidatePath("/bodega/despachos");
  redirect("/bodega/despachos");
}

export async function cerrarDespacho(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("BODEGA");

  const despachoIdRaw = String(formData.get("despacho_id") ?? "");
  if (!/^\d+$/.test(despachoIdRaw)) return { error: "Despacho inválido." };
  const despachoId = BigInt(despachoIdRaw);

  const despacho = await prisma.despachos.findUnique({
    where: { id: despachoId },
    include: { despacho_items: true },
  });
  if (!despacho) return { error: "Despacho no encontrado." };
  if (despacho.estado !== "ABIERTO") {
    return { error: "Este despacho ya está cerrado." };
  }

  // Recopilar valores por item
  type Actualizacion = {
    itemId: bigint;
    tipo: "HERRAMIENTA" | "INSUMO";
    insumoId: bigint | null;
    cantidadOriginal: number;
    devuelto?: boolean;
    consumido?: number;
  };
  const actualizaciones: Actualizacion[] = [];

  for (const item of despacho.despacho_items) {
    if (item.tipo_item === "HERRAMIENTA") {
      const dev = formData.get(`devuelto_${item.id.toString()}`);
      actualizaciones.push({
        itemId: item.id,
        tipo: "HERRAMIENTA",
        insumoId: null,
        cantidadOriginal: Number(item.cantidad),
        devuelto: dev === "on",
      });
    } else {
      const raw = String(
        formData.get(`consumido_${item.id.toString()}`) ?? "",
      ).trim();
      const consumido = Number(raw);
      const cantidadOriginal = Number(item.cantidad);
      if (!Number.isFinite(consumido) || consumido < 0) {
        return { error: `Cantidad consumida inválida en un item.` };
      }
      if (consumido > cantidadOriginal) {
        return {
          error: `La cantidad consumida no puede ser mayor a la despachada.`,
        };
      }
      actualizaciones.push({
        itemId: item.id,
        tipo: "INSUMO",
        insumoId: item.insumo_id,
        cantidadOriginal,
        consumido,
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const a of actualizaciones) {
        if (a.tipo === "HERRAMIENTA") {
          await tx.despacho_items.update({
            where: { id: a.itemId },
            data: { devuelto: a.devuelto ?? false },
          });
        } else {
          if (a.insumoId === null) continue;
          await tx.despacho_items.update({
            where: { id: a.itemId },
            data: { cantidad_consumida: a.consumido! },
          });
          await tx.insumos.update({
            where: { id: a.insumoId },
            data: {
              stock_actual: { decrement: a.consumido! },
              stock_reservado: { decrement: a.cantidadOriginal },
            },
          });
          if (a.consumido! > 0) {
            await tx.movimientos_insumo.create({
              data: {
                insumo_id: a.insumoId,
                tipo: "CONSUMO",
                cantidad: -a.consumido!,
                despacho_item_id: a.itemId,
                usuario_id: usuario.id,
              },
            });
          }
          const devuelto = a.cantidadOriginal - a.consumido!;
          if (devuelto > 0) {
            await tx.movimientos_insumo.create({
              data: {
                insumo_id: a.insumoId,
                tipo: "DEVOLUCION",
                cantidad: devuelto,
                despacho_item_id: a.itemId,
                usuario_id: usuario.id,
              },
            });
          }
        }
      }

      await tx.despachos.update({
        where: { id: despachoId },
        data: { estado: "CERRADO", fecha_devolucion: new Date() },
      });
    });
  } catch (e) {
    return { error: `Error al cerrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/bodega/despachos");
  redirect("/bodega/despachos");
}
```

- [ ] **Step 2: Página "Nuevo despacho"**

`app/(app)/bodega/despachos/nuevo/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioDespacho } from "./_formulario";

export const metadata = { title: "Nuevo despacho" };

export default async function PaginaNuevoDespacho() {
  await requerirUsuario("BODEGA");

  const [personas, herramientas, insumos, asignaciones] = await Promise.all([
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.herramientas.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, total: true },
    }),
    prisma.insumos.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        unidad: true,
        stock_actual: true,
        stock_reservado: true,
      },
    }),
    prisma.asignaciones.findMany({
      where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } },
      select: {
        id: true,
        persona_id: true,
        tipos_tarea: { select: { nombre: true } },
        lotes: { select: { nombre: true } },
        apiarios: { select: { nombre: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Bodega
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nuevo despacho
        </h1>
      </header>
      <FormularioDespacho
        personas={personas.map((p) => ({
          id: p.id.toString(),
          nombre: p.nombre_completo,
        }))}
        herramientas={herramientas.map((h) => ({
          id: h.id.toString(),
          nombre: h.nombre,
          total: h.total,
        }))}
        insumos={insumos.map((i) => ({
          id: i.id.toString(),
          nombre: i.nombre,
          unidad: i.unidad,
          disponible:
            Number(i.stock_actual) - Number(i.stock_reservado),
        }))}
        asignaciones={asignaciones.map((a) => ({
          id: a.id.toString(),
          persona_id: a.persona_id.toString(),
          etiqueta: `${a.tipos_tarea.nombre} · ${
            a.lotes?.nombre ?? a.apiarios?.nombre ?? "—"
          }`,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Formulario cliente con items dinámicos**

`app/(app)/bodega/despachos/nuevo/_formulario.tsx`:
```tsx
"use client";

import { useActionState, useState, useMemo } from "react";
import { Trash2, Wrench, FlaskConical } from "lucide-react";
import { crearDespacho, type EstadoEdicion } from "../acciones";

type Persona = { id: string; nombre: string };
type Herramienta = { id: string; nombre: string; total: number };
type Insumo = { id: string; nombre: string; unidad: string; disponible: number };
type Asignacion = { id: string; persona_id: string; etiqueta: string };

type ItemRow = {
  uid: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  ref_id: string;
  cantidad: string;
};

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioDespacho({
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
  const [estado, formAction, pending] = useActionState(
    crearDespacho,
    ESTADO_INICIAL,
  );
  const [personaId, setPersonaId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const asignacionesFiltradas = useMemo(
    () => asignaciones.filter((a) => a.persona_id === personaId),
    [asignaciones, personaId],
  );

  const agregarItem = (tipo: "HERRAMIENTA" | "INSUMO") => {
    setItems((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        tipo,
        ref_id: "",
        cantidad: "",
      },
    ]);
  };

  const actualizarItem = (uid: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };

  const eliminarItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Trabajador
        </label>
        <select
          name="persona_id"
          required
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {personaId && (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Asignación (opcional)
          </label>
          <select
            name="asignacion_id"
            defaultValue=""
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          >
            <option value="">Sin asignación</option>
            {asignacionesFiltradas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zelanda-verde-900">
            Items ({items.length})
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => agregarItem("HERRAMIENTA")}
              className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1 text-xs text-zelanda-verde-700"
            >
              <Wrench className="h-3.5 w-3.5" /> + Herramienta
            </button>
            <button
              type="button"
              onClick={() => agregarItem("INSUMO")}
              className="inline-flex min-h-touch items-center gap-1 rounded-lg border border-zelanda-verde-700 px-2 py-1 text-xs text-zelanda-verde-700"
            >
              <FlaskConical className="h-3.5 w-3.5" /> + Insumo
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Agrega al menos un item.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {items.map((it) => (
              <li
                key={it.uid}
                className="rounded-lg border border-zelanda-beige-200 p-3"
              >
                <div className="flex items-center justify-between text-xs text-zelanda-verde-700">
                  <span className="font-medium">
                    {it.tipo === "HERRAMIENTA" ? "Herramienta" : "Insumo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminarItem(it.uid)}
                    className="text-estado-vencida"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    required
                    value={it.ref_id}
                    onChange={(e) =>
                      actualizarItem(it.uid, { ref_id: e.target.value })
                    }
                    className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  >
                    <option value="">Selecciona...</option>
                    {it.tipo === "HERRAMIENTA"
                      ? herramientas.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nombre} (×{h.total})
                          </option>
                        ))
                      : insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre} ({i.disponible} {i.unidad})
                          </option>
                        ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    min={it.tipo === "HERRAMIENTA" ? "1" : "0.001"}
                    step={it.tipo === "HERRAMIENTA" ? "1" : "0.001"}
                    required
                    value={it.cantidad}
                    onChange={(e) =>
                      actualizarItem(it.uid, { cantidad: e.target.value })
                    }
                    className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || items.length === 0 || !personaId}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Despachando..." : "Despachar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add "app/(app)/bodega/despachos"
git commit -m "feat(bodega): crear despacho con reserva de stock"
```

---

## Task 9: Detalle de despacho + cerrar

**Files:**
- Create: `app/(app)/bodega/despachos/[id]/page.tsx`
- Create: `app/(app)/bodega/despachos/[id]/_formulario.tsx`

- [ ] **Step 1: Página detalle**

`app/(app)/bodega/despachos/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCierreDespacho } from "./_formulario";

export const metadata = { title: "Despacho" };

export default async function PaginaDetalleDespacho({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("BODEGA");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const despacho = await prisma.despachos.findUnique({
    where: { id: BigInt(id) },
    include: {
      persona: { select: { nombre_completo: true } },
      asignacion: {
        select: {
          tipos_tarea: { select: { nombre: true } },
          lotes: { select: { nombre: true } },
          apiarios: { select: { nombre: true } },
        },
      },
      despacho_items: {
        include: {
          herramientas: { select: { nombre: true } },
          insumos: { select: { nombre: true, unidad: true } },
        },
      },
    },
  });
  if (!despacho) notFound();

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Despacho #{despacho.id.toString()}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {despacho.persona.nombre_completo}
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {fmt(despacho.fecha)}
          {despacho.asignacion && (
            <>
              {" · "}
              {despacho.asignacion.tipos_tarea.nombre} ·{" "}
              {despacho.asignacion.lotes?.nombre ??
                despacho.asignacion.apiarios?.nombre}
            </>
          )}
        </p>
      </header>

      {despacho.estado === "CERRADO" ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <p className="text-sm text-zelanda-verde-700">
            Cerrado el{" "}
            {despacho.fecha_devolucion && fmt(despacho.fecha_devolucion)}
          </p>
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {despacho.despacho_items.map((it) => (
              <li key={it.id.toString()} className="py-2 text-sm">
                {it.tipo_item === "HERRAMIENTA" ? (
                  <p>
                    <span className="font-medium">{it.herramientas?.nombre}</span>{" "}
                    × {it.cantidad.toString()} ·{" "}
                    {it.devuelto ? "devuelta" : "no devuelta"}
                  </p>
                ) : (
                  <p>
                    <span className="font-medium">{it.insumos?.nombre}</span>{" "}
                    despachado {it.cantidad.toString()} {it.insumos?.unidad}, consumido{" "}
                    {it.cantidad_consumida?.toString() ?? "—"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <FormularioCierreDespacho
          despachoId={despacho.id.toString()}
          items={despacho.despacho_items.map((it) => ({
            id: it.id.toString(),
            tipo: it.tipo_item,
            nombre:
              it.tipo_item === "HERRAMIENTA"
                ? it.herramientas?.nombre ?? "?"
                : it.insumos?.nombre ?? "?",
            unidad: it.insumos?.unidad ?? "",
            cantidad: it.cantidad.toString(),
          }))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Formulario de cierre**

`app/(app)/bodega/despachos/[id]/_formulario.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { cerrarDespacho, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

type ItemRow = {
  id: string;
  tipo: "HERRAMIENTA" | "INSUMO";
  nombre: string;
  unidad: string;
  cantidad: string;
};

export function FormularioCierreDespacho({
  despachoId,
  items,
}: {
  despachoId: string;
  items: ItemRow[];
}) {
  const [estado, formAction, pending] = useActionState(
    cerrarDespacho,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="despacho_id" value={despachoId} />

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h3 className="font-serif text-lg text-zelanda-verde-900">Devoluciones</h3>
        <ul className="mt-3 space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-zelanda-beige-200 p-3"
            >
              <p className="text-sm font-medium text-zelanda-verde-900">
                {it.nombre}
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                Despachado: {it.cantidad}{" "}
                {it.tipo === "INSUMO" ? it.unidad : "unidades"}
              </p>
              {it.tipo === "HERRAMIENTA" ? (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`devuelto_${it.id}`}
                    defaultChecked
                    className="h-5 w-5"
                  />
                  Devuelta
                </label>
              ) : (
                <div className="mt-2">
                  <label className="block text-xs text-zelanda-verde-700">
                    Cantidad consumida ({it.unidad})
                  </label>
                  <input
                    type="number"
                    name={`consumido_${it.id}`}
                    min="0"
                    max={it.cantidad}
                    step="0.001"
                    defaultValue={it.cantidad}
                    required
                    className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Cerrando..." : "Cerrar despacho"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add "app/(app)/bodega/despachos/[id]"
git commit -m "feat(bodega): cerrar despacho con consumo y devolucion"
```

---

## Task 10: Inicio almacén `/almacen`

**Files:**
- Modify: `app/(app)/almacen/page.tsx`

- [ ] **Step 1: Reemplazar**

`app/(app)/almacen/page.tsx`:
```tsx
import Link from "next/link";
import { Warehouse, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Almacén" };

export default async function PaginaInicioAlmacen() {
  const usuario = await requerirUsuario("ALMACEN");

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [stockRows, cosechasHoy, salidasHoy] = await Promise.all([
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      where: { fecha: { gte: inicioDia } },
      _count: { _all: true },
      _sum: { cantidad_kg: true },
    }),
  ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Bienvenida, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-zelanda-verde-700">
          <Warehouse className="h-5 w-5" />
          <p className="text-xs uppercase tracking-wider">Stock actual</p>
        </div>
        <p className="mt-2 font-serif text-4xl text-zelanda-verde-900">
          {stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/almacen/cosecha"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingUp className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Cosechas hoy</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {cosechasHoy._count._all} ·{" "}
            {Number(cosechasHoy._sum.peso_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 2,
            })}{" "}
            kg
          </p>
        </Link>

        <Link
          href="/almacen/salidas"
          className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingDown className="h-5 w-5" />
            <p className="text-xs uppercase tracking-wider">Salidas hoy</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {salidasHoy._count._all} ·{" "}
            {Number(salidasHoy._sum.cantidad_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 2,
            })}{" "}
            kg
          </p>
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Registrar cosecha
        </Link>
        <Link
          href="/almacen/salidas/nueva"
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg border border-zelanda-verde-700 px-3 py-2 text-sm text-zelanda-verde-700"
        >
          <Plus className="h-4 w-4" /> Registrar salida
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add app/(app)/almacen/page.tsx
git commit -m "feat(almacen): inicio con stock y actividad del dia"
```

---

## Task 11: Cosechas — lista + crear

**Files:**
- Create: `app/(app)/almacen/cosecha/page.tsx`
- Create: `app/(app)/almacen/cosecha/acciones.ts`
- Create: `app/(app)/almacen/cosecha/nueva/page.tsx`
- Create: `app/(app)/almacen/cosecha/nueva/_formulario.tsx`

- [ ] **Step 1: Lista**

`app/(app)/almacen/cosecha/page.tsx`:
```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Cosechas" };

export default async function PaginaCosechas() {
  await requerirUsuario("ALMACEN");

  const cosechas = await prisma.cosechas.findMany({
    take: 50,
    orderBy: { fecha: "desc" },
    include: {
      persona: { select: { nombre_completo: true } },
      lotes: { select: { nombre: true } },
    },
  });

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Cosechas
          </h1>
        </div>
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {cosechas.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            Aún no hay cosechas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-zelanda-beige-200">
            {cosechas.map((c) => (
              <li
                key={c.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {c.persona.nombre_completo} · {c.lotes.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(c.fecha)} · {c.metodo_medicion}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Acción**

`app/(app)/almacen/cosecha/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

export async function crearCosecha(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("ALMACEN");

  const personaIdRaw = String(formData.get("persona_id") ?? "");
  const loteIdRaw = String(formData.get("lote_id") ?? "");
  const metodo = String(formData.get("metodo") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!/^\d+$/.test(personaIdRaw)) return { error: "Recolector inválido." };
  if (!/^\d+$/.test(loteIdRaw)) return { error: "Lote inválido." };
  if (metodo !== "CANASTA" && metodo !== "BASCULA") {
    return { error: "Método de medición inválido." };
  }

  let pesoKg: number;
  let cantidadCanastas: number | null = null;
  let capacidadCanastaKg: number | null = null;

  if (metodo === "CANASTA") {
    const cRaw = String(formData.get("cantidad_canastas") ?? "").trim();
    const capRaw = String(formData.get("capacidad_canasta_kg") ?? "").trim();
    const c = Number(cRaw);
    const cap = Number(capRaw);
    if (!Number.isInteger(c) || c <= 0) {
      return { error: "Cantidad de canastas debe ser un entero positivo." };
    }
    if (!Number.isFinite(cap) || cap <= 0) {
      return { error: "Capacidad de canasta debe ser positiva." };
    }
    cantidadCanastas = c;
    capacidadCanastaKg = cap;
    pesoKg = c * cap;
  } else {
    const pRaw = String(formData.get("peso_kg") ?? "").trim();
    const p = Number(pRaw);
    if (!Number.isFinite(p) || p <= 0) {
      return { error: "Peso debe ser positivo." };
    }
    pesoKg = p;
  }

  try {
    await prisma.cosechas.create({
      data: {
        persona_id: BigInt(personaIdRaw),
        lote_id: BigInt(loteIdRaw),
        recibido_por_usuario_id: usuario.id,
        metodo_medicion: metodo,
        cantidad_canastas: cantidadCanastas,
        capacidad_canasta_kg: capacidadCanastaKg,
        peso_kg: pesoKg,
        notas,
      },
    });
  } catch (e) {
    return { error: `No se pudo registrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/almacen");
  revalidatePath("/almacen/cosecha");
  redirect("/almacen/cosecha");
}
```

- [ ] **Step 3: Página "Nueva cosecha"**

`app/(app)/almacen/cosecha/nueva/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCosecha } from "./_formulario";

export const metadata = { title: "Nueva cosecha" };

export default async function PaginaNuevaCosecha() {
  await requerirUsuario("ALMACEN");

  const [personas, lotes] = await Promise.all([
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva cosecha
        </h1>
      </header>
      <FormularioCosecha
        personas={personas.map((p) => ({
          id: p.id.toString(),
          nombre: p.nombre_completo,
        }))}
        lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Formulario**

`app/(app)/almacen/cosecha/nueva/_formulario.tsx`:
```tsx
"use client";

import { useActionState, useState } from "react";
import { crearCosecha, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

export function FormularioCosecha({
  personas,
  lotes,
}: {
  personas: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
}) {
  const [estado, formAction, pending] = useActionState(
    crearCosecha,
    ESTADO_INICIAL,
  );
  const [metodo, setMetodo] = useState<"CANASTA" | "BASCULA">("CANASTA");
  const [canastas, setCanastas] = useState("");
  const [capacidad, setCapacidad] = useState("");

  const pesoCalculado =
    metodo === "CANASTA" && canastas && capacidad
      ? Number(canastas) * Number(capacidad)
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Recolector
        </label>
        <select
          name="persona_id"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Lote
        </label>
        <select
          name="lote_id"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        >
          <option value="">Selecciona...</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">
          Método de medición
        </p>
        <div className="mt-1 flex gap-2">
          {(["CANASTA", "BASCULA"] as const).map((m) => (
            <label
              key={m}
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                metodo === m
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300"
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={m}
                checked={metodo === m}
                onChange={() => setMetodo(m)}
                className="sr-only"
              />
              {m === "CANASTA" ? "Canasta" : "Báscula"}
            </label>
          ))}
        </div>
      </div>

      {metodo === "CANASTA" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Cantidad de canastas
            </label>
            <input
              name="cantidad_canastas"
              type="number"
              min="1"
              step="1"
              required
              value={canastas}
              onChange={(e) => setCanastas(e.target.value)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Capacidad por canasta (kg)
            </label>
            <input
              name="capacidad_canasta_kg"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          {pesoCalculado !== null && (
            <p className="rounded-lg bg-zelanda-beige-100 px-3 py-2 text-sm text-zelanda-verde-900">
              Peso calculado: <strong>{pesoCalculado.toFixed(2)} kg</strong>
            </p>
          )}
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Peso (kg)
          </label>
          <input
            name="peso_kg"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar cosecha"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add "app/(app)/almacen/cosecha"
git commit -m "feat(almacen): registrar y listar cosechas"
```

---

## Task 12: Salidas — lista + crear

**Files:**
- Create: `app/(app)/almacen/salidas/page.tsx`
- Create: `app/(app)/almacen/salidas/acciones.ts`
- Create: `app/(app)/almacen/salidas/nueva/page.tsx`
- Create: `app/(app)/almacen/salidas/nueva/_formulario.tsx`

- [ ] **Step 1: Lista**

`app/(app)/almacen/salidas/page.tsx`:
```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Salidas" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

export default async function PaginaSalidas() {
  await requerirUsuario("ALMACEN");

  const salidas = await prisma.salidas_cosecha.findMany({
    take: 50,
    orderBy: { fecha: "desc" },
  });

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Salidas
          </h1>
        </div>
        <Link
          href="/almacen/salidas/nueva"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {salidas.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-zelanda-beige-200">
            {salidas.map((s) => (
              <li
                key={s.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    {s.cliente_detalle && (
                      <span className="truncate text-zelanda-verde-900">
                        {s.cliente_detalle}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(s.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {Number(s.cantidad_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Acción**

`app/(app)/almacen/salidas/acciones.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";

export type EstadoEdicion = { error: string | null };

type TipoSalida = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

function esTipoValido(v: string): v is TipoSalida {
  return v === "VENTA" || v === "CONSUMO" || v === "PERDIDA" || v === "OTRO";
}

export async function crearSalida(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const usuario = await requerirUsuario("ALMACEN");

  const tipoRaw = String(formData.get("tipo") ?? "");
  if (!esTipoValido(tipoRaw)) return { error: "Tipo inválido." };
  const tipo = tipoRaw;

  const cantidadRaw = String(formData.get("cantidad_kg") ?? "").trim();
  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Cantidad debe ser positiva." };
  }

  const cliente = String(formData.get("cliente_detalle") ?? "").trim();
  if (tipo === "VENTA" && !cliente) {
    return { error: "Para ventas, indica el cliente." };
  }
  const clienteDetalle = cliente || null;

  const precioRaw = String(formData.get("precio_total") ?? "").trim();
  let precio: number | null = null;
  if (tipo === "VENTA" && precioRaw) {
    const p = Number(precioRaw);
    if (!Number.isFinite(p) || p <= 0) {
      return { error: "Precio total debe ser positivo." };
    }
    precio = p;
  }

  const notas = String(formData.get("notas") ?? "").trim() || null;

  // Verificar stock
  const stockRows = await prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `;
  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  if (cantidad > stock) {
    return {
      error: `Stock insuficiente. Disponible: ${stock.toFixed(2)} kg`,
    };
  }

  try {
    await prisma.salidas_cosecha.create({
      data: {
        tipo,
        cantidad_kg: cantidad,
        cliente_detalle: clienteDetalle,
        precio_total: precio,
        registrado_por_usuario_id: usuario.id,
        notas,
      },
    });
  } catch (e) {
    return { error: `No se pudo registrar: ${(e as Error)?.message ?? "desconocido"}` };
  }

  revalidatePath("/almacen");
  revalidatePath("/almacen/salidas");
  redirect("/almacen/salidas");
}
```

- [ ] **Step 3: Página "Nueva salida"**

`app/(app)/almacen/salidas/nueva/page.tsx`:
```tsx
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioSalida } from "./_formulario";

export const metadata = { title: "Nueva salida" };

export default async function PaginaNuevaSalida() {
  await requerirUsuario("ALMACEN");
  const rows = await prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `;
  const stock = Number(rows[0]?.stock_kg ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Nueva salida
        </h1>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Stock disponible: {stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
      </header>
      <FormularioSalida stockMax={stock} />
    </div>
  );
}
```

- [ ] **Step 4: Formulario**

`app/(app)/almacen/salidas/nueva/_formulario.tsx`:
```tsx
"use client";

import { useActionState, useState } from "react";
import { crearSalida, type EstadoEdicion } from "../acciones";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

type Tipo = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

export function FormularioSalida({ stockMax }: { stockMax: number }) {
  const [estado, formAction, pending] = useActionState(
    crearSalida,
    ESTADO_INICIAL,
  );
  const [tipo, setTipo] = useState<Tipo>("VENTA");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">Tipo</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["VENTA", "CONSUMO", "PERDIDA", "OTRO"] as const).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                tipo === t
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="sr-only"
              />
              {t === "VENTA"
                ? "Venta"
                : t === "CONSUMO"
                  ? "Consumo"
                  : t === "PERDIDA"
                    ? "Pérdida"
                    : "Otro"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad (kg)
        </label>
        <input
          name="cantidad_kg"
          type="number"
          min="0.01"
          max={stockMax}
          step="0.01"
          required
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {tipo === "VENTA" && (
        <>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Cliente
            </label>
            <input
              name="cliente_detalle"
              required
              placeholder="Nombre exportador / comprador"
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zelanda-verde-900">
              Precio total (COP, opcional)
            </label>
            <input
              name="precio_total"
              type="number"
              min="1"
              step="1"
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
        </>
      )}

      {tipo !== "VENTA" && (
        <div>
          <label className="block text-sm font-medium text-zelanda-verde-900">
            Detalle (opcional)
          </label>
          <input
            name="cliente_detalle"
            placeholder="ej: consumo casa principal"
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          name="notas"
          rows={2}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar salida"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add "app/(app)/almacen/salidas"
git commit -m "feat(almacen): registrar y listar salidas con validacion de stock"
```

---

## Task 13: Vista del jefe — inventario

**Files:**
- Create: `app/(app)/jefe/inventario/page.tsx`

- [ ] **Step 1: Crear**

`app/(app)/jefe/inventario/page.tsx`:
```tsx
import { Wrench, FlaskConical } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Inventario" };

export default async function PaginaInventarioJefe() {
  await requerirUsuario("JEFE");

  const [herramientas, insumos] = await Promise.all([
    prisma.herramientas.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        categoria: string;
        unidad: string;
        stock_actual: string;
        stock_reservado: string;
        stock_disponible: string;
        stock_minimo: string;
        por_debajo_minimo: boolean;
      }[]
    >`
      SELECT
        id, nombre, categoria::text, unidad,
        stock_actual::text, stock_reservado::text,
        stock_disponible::text, stock_minimo::text,
        por_debajo_minimo
      FROM v_insumos_stock
      WHERE activo = TRUE
      ORDER BY nombre
    `,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Inventario
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Inventario de bodega
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <FlaskConical className="h-5 w-5" /> Insumos
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zelanda-beige-200 text-left text-xs uppercase text-zelanda-verde-700">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3 text-right">Actual</th>
                <th className="py-2 pr-3 text-right">Reservado</th>
                <th className="py-2 pr-3 text-right">Disponible</th>
                <th className="py-2 pr-3 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr
                  key={i.id.toString()}
                  className={
                    i.por_debajo_minimo
                      ? "border-b border-zelanda-beige-200 bg-estado-vencida/5"
                      : "border-b border-zelanda-beige-200"
                  }
                >
                  <td className="py-2 pr-3 font-medium text-zelanda-verde-900">
                    {i.nombre}
                  </td>
                  <td className="py-2 pr-3 text-zelanda-verde-700">
                    {i.categoria}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {i.stock_actual} {i.unidad}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {i.stock_reservado}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium ${
                      i.por_debajo_minimo ? "text-estado-vencida" : ""
                    }`}
                  >
                    {i.stock_disponible}
                  </td>
                  <td className="py-2 pr-3 text-right">{i.stock_minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <Wrench className="h-5 w-5" /> Herramientas
        </h2>
        <ul className="mt-3 divide-y divide-zelanda-beige-200">
          {herramientas.map((h) => (
            <li
              key={h.id.toString()}
              className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 text-sm"
            >
              <span className="text-zelanda-verde-900">{h.nombre}</span>
              <span className="text-zelanda-verde-700">{h.categoria}</span>
              <span className="font-medium">×{h.total}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add app/(app)/jefe/inventario/page.tsx
git commit -m "feat(jefe): vista lectura de inventario"
```

---

## Task 14: Vista del jefe — almacén (cosechas + salidas)

**Files:**
- Create: `app/(app)/jefe/almacen-vista/page.tsx`

- [ ] **Step 1: Crear**

`app/(app)/jefe/almacen-vista/page.tsx`:
```tsx
import { Warehouse, TrendingUp, TrendingDown } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Almacén" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

export default async function PaginaAlmacenJefe() {
  await requerirUsuario("JEFE");

  const [stockRows, cosechas, salidas] = await Promise.all([
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
    prisma.cosechas.findMany({
      take: 30,
      orderBy: { fecha: "desc" },
      include: {
        persona: { select: { nombre_completo: true } },
        lotes: { select: { nombre: true } },
      },
    }),
    prisma.salidas_cosecha.findMany({
      take: 30,
      orderBy: { fecha: "desc" },
    }),
  ]);

  const stock = Number(stockRows[0]?.stock_kg ?? 0);
  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Almacén
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Almacén de cosecha
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-zelanda-verde-700">
          <Warehouse className="h-5 w-5" />
          <p className="text-xs uppercase tracking-wider">Stock actual</p>
        </div>
        <p className="mt-2 font-serif text-4xl text-zelanda-verde-900">
          {stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg
        </p>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <TrendingUp className="h-5 w-5" /> Últimas cosechas
        </h2>
        {cosechas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay cosechas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cosechas.map((c) => (
              <li
                key={c.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {c.persona.nombre_completo} · {c.lotes.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(c.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif">
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <TrendingDown className="h-5 w-5" /> Últimas salidas
        </h2>
        {salidas.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {salidas.map((s) => (
              <li
                key={s.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    {s.cliente_detalle && (
                      <span className="truncate text-zelanda-verde-900">
                        {s.cliente_detalle}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(s.fecha)}
                  </p>
                </div>
                <p className="text-right font-serif">
                  {Number(s.cantidad_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add app/(app)/jefe/almacen-vista/page.tsx
git commit -m "feat(jefe): vista lectura almacen con stock cosechas y salidas"
```

---

## Task 15: Tarjetas en dashboard del jefe

**Files:**
- Modify: `app/(app)/jefe/page.tsx`

Agregar 3 tarjetas: stock bajo, despachos abiertos, stock almacén kg.

- [ ] **Step 1: Leer el archivo actual para encontrar dónde insertar las cards**

```bash
# Solo para inspección, no es comando del plan
```

- [ ] **Step 2: Modificar `/jefe/page.tsx` agregando las consultas y la sección**

En la sección donde se hacen las consultas en paralelo (Promise.all), agregar:
```ts
prisma.$queryRaw<{ count: number }[]>`
  SELECT COUNT(*)::int AS count FROM v_insumos_stock
  WHERE activo = TRUE AND por_debajo_minimo = TRUE
`,
prisma.despachos.count({ where: { estado: "ABIERTO" } }),
prisma.$queryRaw<{ stock_kg: string }[]>`
  SELECT stock_kg::text FROM v_stock_almacen
`,
```

Y agregar destructuring de los nuevos valores: `stockBajoRows`, `despachosAbiertos`, `stockAlmacenRows`.

Justo antes del cierre del `<div className="space-y-6">` (o donde quede natural), agregar:
```tsx
<section className="space-y-3">
  <h2 className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
    Operación
  </h2>
  <div className="grid gap-3 sm:grid-cols-3">
    <Link
      href="/jefe/inventario"
      className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
    >
      <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
        Stock bajo
      </p>
      <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
        {stockBajoRows[0]?.count ?? 0}
      </p>
    </Link>
    <Link
      href="/bodega/despachos"
      className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
    >
      <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
        Despachos abiertos
      </p>
      <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
        {despachosAbiertos}
      </p>
    </Link>
    <Link
      href="/jefe/almacen-vista"
      className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
    >
      <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
        Almacén
      </p>
      <p className="mt-1 font-serif text-2xl text-zelanda-verde-900">
        {Number(stockAlmacenRows[0]?.stock_kg ?? 0).toLocaleString("es-CO", {
          maximumFractionDigits: 0,
        })}{" "}
        kg
      </p>
    </Link>
  </div>
</section>
```

Agregar `import Link from "next/link";` si no está.

- [ ] **Step 3: Build + commit**

```bash
npm run build
```
Expected: PASS.

```bash
git add app/(app)/jefe/page.tsx
git commit -m "feat(jefe): tarjetas de stock bodega despachos y almacen en dashboard"
```

---

## Task 16: RLS policies para tablas de Fase 4

**Files:**
- Modify: `supabase/policies.sql` (append)

Agregar políticas para las tablas tocadas. Asume helper `auth.uid()` y `auth.jwt()` para obtener rol del usuario.

- [ ] **Step 1: Apendear políticas**

Agregar al final de `supabase/policies.sql`:
```sql
-- ============================================================
-- FASE 4: políticas para bodega y almacén
-- ============================================================

-- Helper para obtener rol del usuario actual desde usuarios
-- (ya existe en versiones anteriores, omitir si está)
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid()
$$;

-- HERRAMIENTAS: SELECT todos los autenticados; INSERT/UPDATE solo JEFE y BODEGA
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS herramientas_select ON herramientas;
CREATE POLICY herramientas_select ON herramientas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS herramientas_write ON herramientas;
CREATE POLICY herramientas_write ON herramientas FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','BODEGA'))
  WITH CHECK (public.rol_actual() IN ('JEFE','BODEGA'));

-- INSUMOS
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insumos_select ON insumos;
CREATE POLICY insumos_select ON insumos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS insumos_write ON insumos;
CREATE POLICY insumos_write ON insumos FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','BODEGA'))
  WITH CHECK (public.rol_actual() IN ('JEFE','BODEGA'));

-- DESPACHOS
ALTER TABLE despachos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS despachos_select ON despachos;
CREATE POLICY despachos_select ON despachos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS despachos_write ON despachos;
CREATE POLICY despachos_write ON despachos FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','BODEGA'))
  WITH CHECK (public.rol_actual() IN ('JEFE','BODEGA'));

-- DESPACHO_ITEMS
ALTER TABLE despacho_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS despacho_items_select ON despacho_items;
CREATE POLICY despacho_items_select ON despacho_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS despacho_items_write ON despacho_items;
CREATE POLICY despacho_items_write ON despacho_items FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','BODEGA'))
  WITH CHECK (public.rol_actual() IN ('JEFE','BODEGA'));

-- MOVIMIENTOS_INSUMO
ALTER TABLE movimientos_insumo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movimientos_insumo_select ON movimientos_insumo;
CREATE POLICY movimientos_insumo_select ON movimientos_insumo FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS movimientos_insumo_write ON movimientos_insumo;
CREATE POLICY movimientos_insumo_write ON movimientos_insumo FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','BODEGA'))
  WITH CHECK (public.rol_actual() IN ('JEFE','BODEGA'));

-- COSECHAS
ALTER TABLE cosechas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cosechas_select ON cosechas;
CREATE POLICY cosechas_select ON cosechas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cosechas_write ON cosechas;
CREATE POLICY cosechas_write ON cosechas FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','ALMACEN'))
  WITH CHECK (public.rol_actual() IN ('JEFE','ALMACEN'));

-- SALIDAS_COSECHA
ALTER TABLE salidas_cosecha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salidas_cosecha_select ON salidas_cosecha;
CREATE POLICY salidas_cosecha_select ON salidas_cosecha FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS salidas_cosecha_write ON salidas_cosecha;
CREATE POLICY salidas_cosecha_write ON salidas_cosecha FOR ALL TO authenticated
  USING (public.rol_actual() IN ('JEFE','ALMACEN'))
  WITH CHECK (public.rol_actual() IN ('JEFE','ALMACEN'));
```

- [ ] **Step 2: Aplicar en Supabase**

Manual: SQL Editor de Supabase, pegar las políticas (o el archivo completo, son idempotentes). Verificar "Success".

- [ ] **Step 3: Commit**

```bash
git add supabase/policies.sql
git commit -m "feat(fase4): RLS para herramientas insumos despachos cosechas y salidas"
```

---

## Task 17: Verificación final y push

- [ ] **Step 1: Build local completo**

```bash
npm run build
```
Expected: PASS sin errores ni warnings críticos. Anotar el número total de rutas.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: sin errores.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Expected: push sin errores. Vercel auto-deploya.

- [ ] **Step 5: Smoke test en deploy (manual)**

Verificación rápida en el celular después del deploy:
1. Login como Diego (BODEGA) → ver inicio con tarjetas → ir a Inventario → crear un insumo "Químico fumigación", unidad "L", stock mín 10 → ingresar stock 50L → ver disponible 50L → crear herramienta "Fumigadora" total 3.
2. Crear despacho a Diomedes con 2L de químico + 1 fumigadora → ver que reserva el stock (disponible queda 48).
3. Cerrar despacho: consumido 1.5L, herramienta devuelta → stock actual 48.5, reservado 0.
4. Login como Rocío (ALMACEN) → registrar cosecha por 5 canastas × 20kg = 100kg → ver stock 100 → registrar salida VENTA 60kg "Exportadora Andes" → stock queda 40kg.
5. Login como jefe → /jefe/inventario y /jefe/almacen-vista muestran datos reales → dashboard tiene las 3 tarjetas con números correctos.

---

## Self-review checklist (controller)

- [x] Cada tarea tiene archivos concretos y código completo.
- [x] Migración SQL idempotente (DO $$ + IF NOT EXISTS).
- [x] Server actions devuelven `EstadoEdicion` consistente y usan `useActionState`.
- [x] BigInt y Decimal se convierten a string antes de pasar al cliente.
- [x] Validaciones en bordes (stock disponible, cantidad ≤ original).
- [x] Sin emojis, todo en español, min-h-touch consistente.
- [x] RLS cubre las 7 tablas tocadas.
- [x] Tests = build + lint + smoke test manual (no hay framework de tests configurado).
