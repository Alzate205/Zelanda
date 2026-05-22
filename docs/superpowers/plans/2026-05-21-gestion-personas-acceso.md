# Gestión de personas y acceso (UI del jefe) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar tres huecos del CRUD de equipo: capturar fecha de nacimiento, editar la vinculación activa sin cerrarla, y gestionar el acceso de Supabase Auth (crear acceso post-creación, cambiar rol, resetear contraseña).

**Architecture:** Híbrido de dos rutas: la existente `/jefe/equipo/[id]/editar` se extiende con un campo nuevo y un cuarto modo de vinculación; se crea una ruta nueva `/jefe/equipo/[id]/acceso` que centraliza todo lo de Supabase Auth con sub-formularios condicionales según exista o no `usuarios` enlazado a la persona.

**Tech Stack:** Next.js 14 App Router, React 19 (`useActionState`), Prisma 6.19, Supabase Auth (admin via service role), Tailwind. Sin migración SQL. Verificación manual (el proyecto no tiene suite de tests).

**Spec:** [`docs/superpowers/specs/2026-05-21-gestion-personas-acceso-design.md`](../specs/2026-05-21-gestion-personas-acceso-design.md)

---

## Convenciones de este plan

- Sin tests automatizados — el proyecto no tiene `vitest` ni `jest`. Cada tarea termina con un bloque de **verificación manual** (servidor en `localhost:3000`, observar comportamiento, revisar BD si aplica).
- Patrón existente: server actions devuelven `{ error: string | null; exito: string | null }`. Formularios usan `useActionState` con `ESTADO_INICIAL`.
- Cliente Supabase admin: `crearClienteSupabaseAdmin()` desde [`lib/supabase/admin.ts`](../../../lib/supabase/admin.ts). Salta RLS, **solo server-side**.
- Identificación: rol de UI siempre `requerirUsuario("JEFE")` al inicio de pages/actions de jefe.
- Commits: en español, prefijo `feat:` para feature, `fix:` para fixes. Mensaje breve enfocado en el **qué** + breve **por qué** si no es obvio.
- Arrancar dev server con `npm run dev` (Next 14, puerto 3000).

---

## Archivos involucrados

```
app/(app)/jefe/equipo/
├── acciones.ts                              [MODIFICAR — Tarea 1]
├── nuevo/
│   └── FormularioNuevoMiembro.tsx           [MODIFICAR — Tarea 1]
├── [id]/
│   ├── page.tsx                             [MODIFICAR — Tarea 4]
│   ├── acciones.ts                          [MODIFICAR — Tareas 2, 3]
│   ├── editar/
│   │   ├── page.tsx                         [MODIFICAR — Tarea 3]
│   │   └── FormularioEditarMiembro.tsx      [MODIFICAR — Tareas 2, 3]
│   └── acceso/                              [NUEVO — Tareas 4, 5]
│       ├── page.tsx                         [NUEVO]
│       ├── acciones.ts                      [NUEVO]
│       ├── FormularioCrearAcceso.tsx        [NUEVO — Tarea 4]
│       ├── FormularioCambiarRol.tsx         [NUEVO — Tarea 5]
│       └── FormularioResetContrasena.tsx    [NUEVO — Tarea 5]
```

---

## Tarea 1: `fecha_nacimiento` en flujo de crear miembro

**Files:**
- Modify: `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`
- Modify: `app/(app)/jefe/equipo/acciones.ts`

La columna `personas.fecha_nacimiento` (`DateTime? @db.Date`) ya existe — solo falta exponerla en formulario y action.

- [ ] **Step 1: Agregar input `fecha_nacimiento` al formulario nuevo**

Editar [`app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`](../../../app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx).

Dentro de la sección 1 ("Datos de la persona"), después del `div` con `cedula`/`telefono` (línea ~96, justo antes del `div` con `notas`), insertar:

```tsx
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
```

- [ ] **Step 2: Agregar parsing + validación en `crearMiembro`**

Editar [`app/(app)/jefe/equipo/acciones.ts`](../../../app/(app)/jefe/equipo/acciones.ts).

Después de la línea que parsea `notas` (línea ~39), agregar:

```ts
const fechaNacRaw = String(formData.get("fecha_nacimiento") ?? "").trim();
let fecha_nacimiento: Date | null = null;
if (fechaNacRaw) {
  const d = new Date(fechaNacRaw);
  if (Number.isNaN(d.getTime())) {
    return { ...ESTADO_INICIAL, error: "Fecha de nacimiento inválida." };
  }
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (d > hoy) {
    return { ...ESTADO_INICIAL, error: "La fecha de nacimiento no puede ser futura." };
  }
  fecha_nacimiento = d;
}
```

En el bloque `prisma.personas.create` (línea ~114-123), agregar `fecha_nacimiento` al `data`:

```ts
data: {
  id: nextId,
  nombre_completo,
  cedula,
  telefono,
  fecha_nacimiento,
  notas,
  activo: true,
},
```

- [ ] **Step 3: Verificación manual**

Arrancar dev server:
```bash
npm run dev
```

Probar:
1. Ir a `/jefe/equipo/nuevo` como JEFE.
2. Crear persona con fecha de nacimiento (ej. 1985-03-15) y sin acceso → submit.
3. Ir al detalle de la persona creada → ver que la sección "Datos personales" muestra la fecha (no "—").
4. Intentar crear con fecha futura (2030-01-01) → ver mensaje "La fecha de nacimiento no puede ser futura."
5. Crear persona sin fecha → submit → detalle muestra "—".

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx app/\(app\)/jefe/equipo/acciones.ts
git commit -m "feat(equipo): capturar fecha de nacimiento al crear miembro"
```

---

## Tarea 2: `fecha_nacimiento` en flujo de editar miembro

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/editar/page.tsx`
- Modify: `app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`
- Modify: `app/(app)/jefe/equipo/[id]/acciones.ts`

- [ ] **Step 1: Pasar `fecha_nacimiento` desde la page al formulario**

Editar [`app/(app)/jefe/equipo/[id]/editar/page.tsx`](../../../app/(app)/jefe/equipo/[id]/editar/page.tsx).

En el `select` del `findUnique` (línea ~25-34), el `include` actual carga `vinculaciones` pero **no** se restringe el `select` de la persona, así que `fecha_nacimiento` ya viene en la query. El cambio es solo en cómo se pasa al componente. Reemplazar el `return` (línea ~45-56) por:

```tsx
return (
  <FormularioEditarMiembro
    persona={{
      id: String(persona.id),
      nombre_completo: persona.nombre_completo,
      cedula: persona.cedula,
      telefono: persona.telefono,
      fecha_nacimiento: persona.fecha_nacimiento
        ? persona.fecha_nacimiento.toISOString().slice(0, 10)
        : null,
      notas: persona.notas,
    }}
    vincActiva={vincActiva}
  />
);
```

- [ ] **Step 2: Recibir y mostrar `fecha_nacimiento` en el formulario**

Editar [`app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`](../../../app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx).

Extender el tipo `Persona` (línea ~19-25):

```ts
type Persona = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  notas: string | null;
};
```

En la sección "Datos personales", después del `div` con `cedula`/`telefono` (línea ~107), insertar antes del `div` con `notas`:

```tsx
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
```

- [ ] **Step 3: Persistir `fecha_nacimiento` en `actualizarPersonaYVinculacion`**

Editar [`app/(app)/jefe/equipo/[id]/acciones.ts`](../../../app/(app)/jefe/equipo/[id]/acciones.ts).

Después del parsing de `notas` (línea ~38), agregar:

```ts
const fechaNacRaw = String(formData.get("fecha_nacimiento") ?? "").trim();
let fecha_nacimiento: Date | null = null;
if (fechaNacRaw) {
  const d = new Date(fechaNacRaw);
  if (Number.isNaN(d.getTime())) {
    return { error: "Fecha de nacimiento inválida." };
  }
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (d > hoy) {
    return { error: "La fecha de nacimiento no puede ser futura." };
  }
  fecha_nacimiento = d;
}
```

En el `prisma.personas.update` (línea ~48-51), agregar `fecha_nacimiento` al `data`:

```ts
await prisma.personas.update({
  where: { id: personaId },
  data: { nombre_completo, cedula, telefono, fecha_nacimiento, notas },
});
```

- [ ] **Step 4: Verificación manual**

1. Ir a `/jefe/equipo/[id]/editar` para una persona sin fecha → completar fecha → guardar → detalle muestra fecha.
2. Editar la persona otra vez → la fecha aparece prefilled en el input → cambiar a otra fecha → guardar → detalle actualizado.
3. Editar y borrar la fecha (dejar el input vacío) → guardar → detalle muestra "—".
4. Intentar fecha futura → mensaje claro y la persona no se actualiza.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/jefe/equipo/\[id\]/editar/page.tsx app/\(app\)/jefe/equipo/\[id\]/editar/FormularioEditarMiembro.tsx app/\(app\)/jefe/equipo/\[id\]/acciones.ts
git commit -m "feat(equipo): editar fecha de nacimiento desde miembro existente"
```

---

## Tarea 3: Modo "Editar vinculación activa" sin cerrarla

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/editar/page.tsx`
- Modify: `app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`
- Modify: `app/(app)/jefe/equipo/[id]/acciones.ts`

Hoy el editor permite "dejar", "cambiar" o "cerrar" vinculación. Se agrega un cuarto modo: "editar" que hace UPDATE in-place sobre la fila con `fecha_fin IS NULL`, sin tocar histórico.

- [ ] **Step 1: Cargar la vinc activa completa en el server component**

Editar [`app/(app)/jefe/equipo/[id]/editar/page.tsx`](../../../app/(app)/jefe/equipo/[id]/editar/page.tsx).

El `select` actual solo trae `{ tipo, rol_finca }`. Necesitamos también los campos editables. Reemplazar el `include.vinculaciones` (línea ~28-32) por:

```ts
vinculaciones: {
  where: { fecha_fin: null },
  take: 1,
  select: {
    tipo: true,
    rol_finca: true,
    salario_base: true,
    periodo_pago: true,
    tarifa_jornal: true,
  },
},
```

Reemplazar la construcción de `vincActiva` (línea ~38-43) por:

```ts
const v = persona.vinculaciones[0];
const vincActiva = v
  ? {
      tipo: v.tipo as TipoVinculacion,
      rol_finca: v.rol_finca,
      salario_base: v.salario_base ? Number(v.salario_base) : null,
      periodo_pago: v.periodo_pago,
      tarifa_jornal: v.tarifa_jornal ? Number(v.tarifa_jornal) : null,
    }
  : null;
```

El import de `TipoVinculacion` en línea 6 ya existe y es suficiente — no se necesita importar `TipoPeriodoPago` en este archivo (se pasa como string al componente cliente).

- [ ] **Step 2: Aceptar nuevo modo "editar" en la action**

Editar [`app/(app)/jefe/equipo/[id]/acciones.ts`](../../../app/(app)/jefe/equipo/[id]/acciones.ts).

Extender el type-guard `esModoValido` (línea ~17-19):

```ts
function esModoValido(v: string): v is "dejar" | "cambiar" | "cerrar" | "editar" {
  return v === "dejar" || v === "cambiar" || v === "cerrar" || v === "editar";
}
```

Después del bloque del modo `"cerrar"` (después de la línea 67, antes del comentario `// modo === "cambiar"`), insertar el bloque del modo `"editar"`:

```ts
if (modo === "editar") {
  const activas = await prisma.vinculaciones.count({
    where: { persona_id: personaId, fecha_fin: null },
  });
  if (activas === 0) {
    return { error: "No hay vinculación activa para editar." };
  }
  if (activas > 1) {
    return {
      error:
        "Hay más de una vinculación activa para esta persona. Pídele al admin que revise la base de datos.",
    };
  }

  const vincActual = await prisma.vinculaciones.findFirst({
    where: { persona_id: personaId, fecha_fin: null },
    select: { tipo: true },
  });
  if (!vincActual) {
    return { error: "Vinculación activa no encontrada." };
  }
  const tipoActual = vincActual.tipo as TipoVinculacion;

  const rol_finca = String(formData.get("edit_rol_finca") ?? "").trim() || null;
  const salarioRaw = String(formData.get("edit_salario_base") ?? "").trim();
  const periodoRaw = String(formData.get("edit_periodo_pago") ?? "");
  const tarifaRaw = String(formData.get("edit_tarifa_jornal") ?? "").trim();

  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;

  if (tipoActual === "FIJO") {
    const s = Number(salarioRaw);
    if (!Number.isFinite(s) || s <= 0) {
      return { error: "Salario base inválido para FIJO." };
    }
    salario_base = s;
    if (!esPeriodoValido(periodoRaw)) {
      return { error: "Período de pago inválido para FIJO." };
    }
    periodo_pago = periodoRaw;
  } else if (tipoActual === "JORNALERO") {
    const t = Number(tarifaRaw);
    if (!Number.isFinite(t) || t <= 0) {
      return { error: "Tarifa por jornal inválida para JORNALERO." };
    }
    tarifa_jornal = t;
  }

  await prisma.vinculaciones.updateMany({
    where: { persona_id: personaId, fecha_fin: null },
    data: { rol_finca, salario_base, periodo_pago, tarifa_jornal },
  });

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
```

- [ ] **Step 3: Agregar el radio "editar" + sub-form en el cliente**

Editar [`app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`](../../../app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx).

Extender el type `ModoVinculacion` (línea ~17):

```ts
type ModoVinculacion = "dejar" | "editar" | "cambiar" | "cerrar";
```

Extender el type `VinculacionActiva` (línea ~27-30):

```ts
type VinculacionActiva = {
  tipo: TipoVinculacion;
  rol_finca: string | null;
  salario_base: number | null;
  periodo_pago: string | null;
  tarifa_jornal: number | null;
} | null;
```

Después del primer radio ("dejar", línea ~138-156), antes del radio "cambiar", insertar el nuevo radio "editar":

```tsx
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
      Corrige rol, salario o tarifa sin tocar histórico. No cambia el tipo
      (para eso usa &ldquo;Cambiar a otro tipo&rdquo;).
    </span>
  </span>
</label>
```

Después del bloque condicional `modo === "cambiar"` (después de línea ~281, antes de `modo === "cerrar"`), insertar el sub-form del modo "editar":

```tsx
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
            type="number"
            min="0"
            step="1000"
            required
            defaultValue={vincActiva.salario_base ?? ""}
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
          type="number"
          min="0"
          step="1000"
          required
          defaultValue={vincActiva.tarifa_jornal ?? ""}
          className={inputBase}
        />
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
```

- [ ] **Step 4: Verificación manual**

Asegurarse de tener al menos una persona FIJO y una JORNALERO (si no, crear desde `/jefe/equipo/nuevo`).

1. Editar persona FIJO → elegir "Editar la activa" → cambiar salario y rol_finca → guardar → detalle refleja los nuevos valores. En la BD (consulta `SELECT * FROM vinculaciones WHERE persona_id = ?`), la **misma fila** queda actualizada — no hay fila nueva con `fecha_fin` rellena.
2. Editar persona JORNALERO → "Editar la activa" → cambiar tarifa → guardar → detalle ok, una sola fila en BD.
3. Editar persona sin vinculación activa → el radio "Editar la activa" está deshabilitado.
4. Intentar enviar salario 0 o negativo → mensaje de error claro.
5. (Caso esquina) Insertar manualmente una segunda fila activa por SQL para una persona y luego intentar editar desde la UI → ver mensaje "Hay más de una vinculación activa...".

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/jefe/equipo/\[id\]/editar/page.tsx app/\(app\)/jefe/equipo/\[id\]/editar/FormularioEditarMiembro.tsx app/\(app\)/jefe/equipo/\[id\]/acciones.ts
git commit -m "feat(equipo): editar vinculacion activa in-place sin ensuciar historico"
```

---

## Tarea 4: Ruta `/acceso` — caso "persona sin usuario" (crear acceso)

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/page.tsx`
- Create: `app/(app)/jefe/equipo/[id]/acceso/page.tsx`
- Create: `app/(app)/jefe/equipo/[id]/acceso/acciones.ts`
- Create: `app/(app)/jefe/equipo/[id]/acceso/FormularioCrearAcceso.tsx`

- [ ] **Step 1: Crear la action `crearAccesoParaPersona`**

Crear [`app/(app)/jefe/equipo/[id]/acceso/acciones.ts`](../../../app/(app)/jefe/equipo/[id]/acceso/acciones.ts) (archivo nuevo):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import type { RolUsuario } from "@/types";

export type EstadoAcceso = { error: string | null; exito: string | null };
const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === "JEFE" || v === "BODEGA" || v === "ALMACEN" || v === "TRABAJADOR";
}

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function crearAccesoParaPersona(
  _prev: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  if (!personaId) return { ...ESTADO_INICIAL, error: "ID de persona inválido." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rolRaw = String(formData.get("rol") ?? "");

  if (!email.includes("@")) {
    return { ...ESTADO_INICIAL, error: "Correo inválido." };
  }
  if (password.length < 8) {
    return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!esRolValido(rolRaw)) {
    return { ...ESTADO_INICIAL, error: "Rol inválido." };
  }
  const rol = rolRaw;

  const persona = await prisma.personas.findUnique({
    where: { id: personaId },
    include: { usuarios: { select: { id: true } } },
  });
  if (!persona || persona.deleted_at) {
    return { ...ESTADO_INICIAL, error: "Persona no encontrada." };
  }
  if (persona.usuarios.length > 0) {
    return { ...ESTADO_INICIAL, error: "Esta persona ya tiene acceso al sistema." };
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: persona.nombre_completo },
  });

  if (authError || !authData?.user) {
    const yaRegistrado = /already registered|already exists/i.test(authError?.message ?? "");
    return {
      ...ESTADO_INICIAL,
      error: yaRegistrado
        ? "Ese correo ya está registrado en el sistema."
        : `Error al crear el acceso: ${authError?.message ?? "desconocido"}.`,
    };
  }

  try {
    await prisma.usuarios.create({
      data: {
        id: authData.user.id,
        email,
        nombre_completo: persona.nombre_completo,
        rol,
        persona_id: personaId,
        activo: true,
      },
    });
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo enlazar el acceso: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
```

- [ ] **Step 2: Crear `FormularioCrearAcceso`**

Crear [`app/(app)/jefe/equipo/[id]/acceso/FormularioCrearAcceso.tsx`](../../../app/(app)/jefe/equipo/[id]/acceso/FormularioCrearAcceso.tsx) (archivo nuevo):

```tsx
"use client";

import { useActionState } from "react";
import { crearAccesoParaPersona, type EstadoAcceso } from "./acciones";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioCrearAcceso({ personaId }: { personaId: string }) {
  const [estado, accion, pendiente] = useActionState(
    crearAccesoParaPersona,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="persona_id" value={personaId} />

      <div>
        <label htmlFor="email" className={labelBase}>
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelBase}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-zelanda-verde-700">
          Mínimo 8 caracteres. Compártela por canal seguro.
        </p>
      </div>

      <div>
        <label htmlFor="rol" className={labelBase}>
          Rol en la app
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue="TRABAJADOR"
          required
          className={inputBase}
        >
          <option value="TRABAJADOR">Trabajador</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="JEFE">Jefe</option>
        </select>
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Creando…" : "Dar acceso"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Crear la server page `/acceso/page.tsx` (con render condicional)**

Crear [`app/(app)/jefe/equipo/[id]/acceso/page.tsx`](../../../app/(app)/jefe/equipo/[id]/acceso/page.tsx) (archivo nuevo):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCrearAcceso } from "./FormularioCrearAcceso";

export const metadata: Metadata = { title: "Gestionar acceso" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaAcceso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const persona = await prisma.personas.findUnique({
    where: { id: idBig },
    include: {
      usuarios: { select: { id: true, email: true, rol: true } },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const idStr = String(persona.id);
  const usuario = persona.usuarios[0];

  if (persona.usuarios.length > 1) {
    return (
      <div className="space-y-5">
        <Link
          href={`/jefe/equipo/${idStr}`}
          className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {persona.nombre_completo}
        </Link>
        <p className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          Esta persona tiene más de una cuenta de acceso enlazada. Pídele al
          admin que revise la tabla <code>usuarios</code> antes de continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/jefe/equipo/${idStr}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {persona.nombre_completo}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Acceso al sistema
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {usuario ? "Gestionar acceso" : "Dar acceso al sistema"}
        </h1>
      </header>

      {usuario ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <p className="text-sm text-zelanda-verde-700">
            Cuenta actual: <span className="font-medium text-zelanda-verde-900">{usuario.email}</span> · rol <span className="font-medium text-zelanda-verde-900">{usuario.rol}</span>.
          </p>
          <p className="mt-3 text-sm text-zelanda-verde-700">
            (Cambiar rol y resetear contraseña se habilitan en la siguiente tarea.)
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Crear cuenta de acceso
          </h2>
          <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
            Esta persona aún no puede entrar a la app. Configura su correo,
            contraseña inicial y rol.
          </p>
          <FormularioCrearAcceso personaId={idStr} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Agregar link "Gestionar acceso" / "Dar acceso al sistema" en el detalle**

Editar [`app/(app)/jefe/equipo/[id]/page.tsx`](../../../app/(app)/jefe/equipo/[id]/page.tsx).

En la sección "Acceso" al final (línea ~207-223), reemplazar el bloque completo por:

```tsx
{/* Acceso */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <div className="flex items-center justify-between gap-3">
    <h2 className="font-serif text-base text-zelanda-verde-900">
      Acceso al sistema
    </h2>
    <Link
      href={`/jefe/equipo/${idStr}/acceso`}
      className="inline-flex min-h-touch items-center rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-xs font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
    >
      {usuario ? "Gestionar" : "Dar acceso"}
    </Link>
  </div>
  {usuario ? (
    <dl className="mt-3 space-y-2 text-sm">
      <div>
        <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Correo</dt>
        <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Rol</dt>
        <dd className="mt-0.5 text-zelanda-verde-900">{usuario.rol}</dd>
      </div>
    </dl>
  ) : (
    <p className="mt-2 text-sm text-zelanda-verde-700">
      Esta persona aún no puede entrar a la app.
    </p>
  )}
</section>
```

- [ ] **Step 5: Verificación manual**

1. Crear persona sin acceso desde `/jefe/equipo/nuevo` (desmarcar "Crear cuenta").
2. En el detalle → sección "Acceso al sistema" muestra "Esta persona aún no puede entrar..." + botón "Dar acceso".
3. Click → `/jefe/equipo/[id]/acceso` muestra form.
4. Llenar email único + password (8+ chars) + rol → submit.
5. Redirige al detalle, que ahora muestra correo + rol y el botón cambia a "Gestionar".
6. Intentar crear con un email ya registrado → mensaje "Ese correo ya está registrado en el sistema."
7. Intentar con password de 5 caracteres → mensaje claro.
8. (Para verificar el rollback) — opcional: provocar fallo en `prisma.usuarios.create` insertando manualmente un row con el mismo email antes; verificar que el user en Supabase Auth se borra.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/jefe/equipo/\[id\]/page.tsx "app/(app)/jefe/equipo/[id]/acceso"
git commit -m "feat(equipo): crear acceso para persona existente desde UI"
```

---

## Tarea 5: Caso "persona con usuario" — cambiar rol + resetear contraseña

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/acceso/acciones.ts`
- Modify: `app/(app)/jefe/equipo/[id]/acceso/page.tsx`
- Create: `app/(app)/jefe/equipo/[id]/acceso/FormularioCambiarRol.tsx`
- Create: `app/(app)/jefe/equipo/[id]/acceso/FormularioResetContrasena.tsx`

- [ ] **Step 1: Agregar las dos actions nuevas**

Editar [`app/(app)/jefe/equipo/[id]/acceso/acciones.ts`](../../../app/(app)/jefe/equipo/[id]/acceso/acciones.ts).

Agregar al final del archivo:

```ts
export async function cambiarRolUsuario(
  _prev: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  await requerirUsuario("JEFE");

  const personaIdRaw = String(formData.get("persona_id") ?? "");
  const personaId = parsearId(personaIdRaw);
  if (!personaId) return { ...ESTADO_INICIAL, error: "ID de persona inválido." };

  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  if (!usuarioId) return { ...ESTADO_INICIAL, error: "ID de usuario inválido." };

  const rolRaw = String(formData.get("rol") ?? "");
  if (!esRolValido(rolRaw)) {
    return { ...ESTADO_INICIAL, error: "Rol inválido." };
  }

  try {
    await prisma.usuarios.update({
      where: { id: usuarioId },
      data: { rol: rolRaw },
    });
  } catch (e) {
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo cambiar el rol: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath(`/jefe/equipo/${personaId}/acceso`);
  revalidatePath("/jefe/equipo");
  return { error: null, exito: "Rol actualizado." };
}

export async function resetearContrasenaUsuario(
  _prev: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  await requerirUsuario("JEFE");

  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  if (!usuarioId) return { ...ESTADO_INICIAL, error: "ID de usuario inválido." };

  const nueva = String(formData.get("contrasena_nueva") ?? "");
  const confirm = String(formData.get("contrasena_confirmacion") ?? "");

  if (nueva.length < 8) {
    return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (nueva !== confirm) {
    return { ...ESTADO_INICIAL, error: "Las contraseñas no coinciden." };
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, {
    password: nueva,
  });

  if (error) {
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo resetear: ${error.message}`,
    };
  }

  return {
    error: null,
    exito: "Contraseña actualizada. Compártesela al usuario.",
  };
}
```

- [ ] **Step 2: Crear `FormularioCambiarRol`**

Crear [`app/(app)/jefe/equipo/[id]/acceso/FormularioCambiarRol.tsx`](../../../app/(app)/jefe/equipo/[id]/acceso/FormularioCambiarRol.tsx) (archivo nuevo):

```tsx
"use client";

import { useActionState } from "react";
import { cambiarRolUsuario, type EstadoAcceso } from "./acciones";
import type { RolUsuario } from "@/types";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioCambiarRol({
  personaId,
  usuarioId,
  rolActual,
}: {
  personaId: string;
  usuarioId: string;
  rolActual: RolUsuario;
}) {
  const [estado, accion, pendiente] = useActionState(
    cambiarRolUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="persona_id" value={personaId} />
      <input type="hidden" name="usuario_id" value={usuarioId} />

      <div>
        <label htmlFor="rol" className={labelBase}>
          Rol en la app
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue={rolActual}
          required
          className={inputBase}
        >
          <option value="TRABAJADOR">Trabajador</option>
          <option value="BODEGA">Bodega</option>
          <option value="ALMACEN">Almacén</option>
          <option value="JEFE">Jefe</option>
        </select>
      </div>

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-zelanda-verde-300 bg-zelanda-verde-50 px-3 py-2 text-sm text-zelanda-verde-800"
        >
          {estado.exito}
        </p>
      ) : null}
      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2.5 text-sm font-medium text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60"
      >
        {pendiente ? "Guardando…" : "Cambiar rol"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Crear `FormularioResetContrasena`**

Crear [`app/(app)/jefe/equipo/[id]/acceso/FormularioResetContrasena.tsx`](../../../app/(app)/jefe/equipo/[id]/acceso/FormularioResetContrasena.tsx) (archivo nuevo):

```tsx
"use client";

import { useActionState } from "react";
import { resetearContrasenaUsuario, type EstadoAcceso } from "./acciones";

const ESTADO_INICIAL: EstadoAcceso = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";
const labelBase = "block text-sm font-medium text-zelanda-verde-800";

export function FormularioResetContrasena({
  usuarioId,
}: {
  usuarioId: string;
}) {
  const [estado, accion, pendiente] = useActionState(
    resetearContrasenaUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="space-y-3" noValidate>
      <input type="hidden" name="usuario_id" value={usuarioId} />

      <div>
        <label htmlFor="contrasena_nueva" className={labelBase}>
          Nueva contraseña
        </label>
        <input
          id="contrasena_nueva"
          name="contrasena_nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="contrasena_confirmacion" className={labelBase}>
          Confirmar
        </label>
        <input
          id="contrasena_confirmacion"
          name="contrasena_confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputBase}
        />
      </div>

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-zelanda-verde-300 bg-zelanda-verde-50 px-3 py-2 text-sm text-zelanda-verde-800"
        >
          {estado.exito}
        </p>
      ) : null}
      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2.5 text-sm font-medium text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60"
      >
        {pendiente ? "Reseteando…" : "Resetear contraseña"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Renderizar los dos forms cuando hay usuario**

Editar [`app/(app)/jefe/equipo/[id]/acceso/page.tsx`](../../../app/(app)/jefe/equipo/[id]/acceso/page.tsx).

Agregar al bloque de imports del top (después de Tarea 4, `FormularioCrearAcceso` ya está importado; agregar **solo** los nuevos):

```tsx
import { FormularioCambiarRol } from "./FormularioCambiarRol";
import { FormularioResetContrasena } from "./FormularioResetContrasena";
import type { RolUsuario } from "@/types";
```

Reemplazar el bloque `{usuario ? (...) : (...)}` (las dos secciones grandes que renderizan según `usuario`) por:

```tsx
{usuario ? (
  <>
    <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
      <h2 className="font-serif text-base text-zelanda-verde-900">
        Cuenta actual
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Correo</dt>
          <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Rol actual</dt>
          <dd className="mt-0.5 text-zelanda-verde-900">{usuario.rol}</dd>
        </div>
      </dl>
    </section>

    <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
      <h2 className="font-serif text-base text-zelanda-verde-900">
        Cambiar rol
      </h2>
      <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
        Define qué interfaz ve esta persona al entrar (trabajador, bodega,
        almacén o jefe).
      </p>
      <FormularioCambiarRol
        personaId={idStr}
        usuarioId={usuario.id}
        rolActual={usuario.rol as RolUsuario}
      />
    </section>

    <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
      <h2 className="font-serif text-base text-zelanda-verde-900">
        Resetear contraseña
      </h2>
      <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
        Pon una contraseña temporal y compártesela al usuario por canal seguro.
      </p>
      <FormularioResetContrasena usuarioId={usuario.id} />
    </section>
  </>
) : (
  <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
    <h2 className="font-serif text-base text-zelanda-verde-900">
      Crear cuenta de acceso
    </h2>
    <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
      Esta persona aún no puede entrar a la app. Configura su correo,
      contraseña inicial y rol.
    </p>
    <FormularioCrearAcceso personaId={idStr} />
  </section>
)}
```

- [ ] **Step 5: Verificación manual**

1. Persona con acceso (puede ser un usuario fijo, ej. el propio jefe en cuenta de prueba) → desde el detalle → "Gestionar" → muestra cuenta actual + dos forms.
2. Cambiar rol de TRABAJADOR a BODEGA → guardar → mensaje de éxito.
3. Volver al detalle → rol actualizado.
4. Logout y login con esa misma cuenta → debería ver UI de BODEGA, no de TRABAJADOR (verifica que la RLS y el routing responden).
5. (Devolver el rol original para no romper tests futuros.)
6. Resetear contraseña con dos campos que coincidan → mensaje "Contraseña actualizada..." → logout y login con la contraseña nueva.
7. Resetear con contraseña < 8 caracteres → mensaje claro.
8. Resetear con dos campos que no coinciden → mensaje claro.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/jefe/equipo/[id]/acceso"
git commit -m "feat(equipo): cambiar rol y resetear contrasena de usuario existente"
```

---

## Verificación final del paquete

Antes de cerrar el branch / push:

- [ ] `npm run build` corre sin errores de TypeScript ni de Next.

```bash
npm run build
```

Expected: termina con "Compiled successfully" y sin warnings nuevos de TypeScript.

- [ ] Todos los flujos verificados manualmente (los 5 bloques de "Verificación manual" arriba).

- [ ] Push a remoto:

```bash
git push origin main
```

Esperar el deploy de Vercel y confirmar en producción que las nuevas rutas y campos funcionan.
