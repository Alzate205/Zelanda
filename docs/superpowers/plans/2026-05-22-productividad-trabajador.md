# Productividad por trabajador — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sección "Productividad" en la ficha de persona (`/jefe/equipo/[id]`) con 4 métricas (kg cosechados, árboles atendidos, novedades reportadas, tareas completadas) en últimos 30 días y acumulado lifetime.

**Architecture:** 8 queries Prisma (aggregate/count) ejecutadas en paralelo dentro del server component existente. JSX agrega una sección entre "Vinculación activa" y "Histórico de vinculaciones". Si los 4 acumulados son 0, mostrar mensaje "Sin actividad operativa registrada".

**Tech Stack:** Next.js 15.5, Prisma 6.19, Tailwind, TypeScript. Sin migración SQL.

**Spec:** [`docs/superpowers/specs/2026-05-22-productividad-trabajador-design.md`](../specs/2026-05-22-productividad-trabajador-design.md)

---

## Convenciones de este plan

- Patrón existente: las 4 queries de cada métrica (1 para 30d + 1 para lifetime) van en `Promise.all` junto al `findUnique` actual.
- Filtrar últimos 30 días con `new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)`.
- `aggregate({ _sum })` cuando `_sum` no encuentra rows devuelve `null` — castear con `Number(_sum.xxx ?? 0)`.
- Sin tests automatizados. Verificación manual al final.
- Trabajar en `main` directamente.

## Archivos involucrados

```
app/(app)/jefe/equipo/[id]/page.tsx           [MODIFICAR]
└── Agregar 8 queries + render de sección Productividad
```

Un solo archivo, una sola tarea con steps granulares.

---

## Tarea 1: Sección Productividad en ficha de persona

**Files:**
- Modify: `app/(app)/jefe/equipo/[id]/page.tsx`

- [ ] **Step 1: Agregar las 8 queries en `Promise.all`**

El archivo actual hace `const persona = await prisma.personas.findUnique({...})` solo. Reemplazar ese bloque por un `Promise.all` que incluye persona + las 8 métricas.

Buscar el bloque actual (alrededor de línea 47-53):

```tsx
const persona = await prisma.personas.findUnique({
  where: { id: idBig },
  include: {
    usuarios: { select: { id: true, email: true, rol: true, activo: true } },
    vinculaciones: { orderBy: { fecha_inicio: "desc" } },
  },
});
```

Reemplazar por:

```tsx
const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const [
  persona,
  cosecha30d,
  cosechaTotal,
  arboles30d,
  arbolesTotal,
  novedades30d,
  novedadesTotal,
  tareas30d,
  tareasTotal,
] = await Promise.all([
  prisma.personas.findUnique({
    where: { id: idBig },
    include: {
      usuarios: { select: { id: true, email: true, rol: true, activo: true } },
      vinculaciones: { orderBy: { fecha_inicio: "desc" } },
    },
  }),
  prisma.cosechas.aggregate({
    where: { persona_id: idBig, fecha: { gte: hace30dias } },
    _sum: { peso_kg: true },
  }),
  prisma.cosechas.aggregate({
    where: { persona_id: idBig },
    _sum: { peso_kg: true },
  }),
  prisma.registros_avance.aggregate({
    where: {
      persona_id: idBig,
      tipo_registro: { in: ["TRAMO", "SUELTOS"] },
      fecha_registro: { gte: hace30dias },
    },
    _sum: { cantidad_arboles: true },
  }),
  prisma.registros_avance.aggregate({
    where: {
      persona_id: idBig,
      tipo_registro: { in: ["TRAMO", "SUELTOS"] },
    },
    _sum: { cantidad_arboles: true },
  }),
  prisma.registros_avance.count({
    where: {
      persona_id: idBig,
      tipo_registro: "NOVEDAD",
      fecha_registro: { gte: hace30dias },
    },
  }),
  prisma.registros_avance.count({
    where: { persona_id: idBig, tipo_registro: "NOVEDAD" },
  }),
  prisma.asignaciones.count({
    where: {
      persona_id: idBig,
      estado: "COMPLETADA",
      fecha_completada: { gte: hace30dias },
    },
  }),
  prisma.asignaciones.count({
    where: { persona_id: idBig, estado: "COMPLETADA" },
  }),
]);
```

- [ ] **Step 2: Calcular valores y flag "hay actividad" antes del JSX**

Buscar la línea donde se calcula `vincActiva` (alrededor de línea 57). Justo después de:

```tsx
const vincActiva = persona.vinculaciones.find((v) => v.fecha_fin === null);
const historial = persona.vinculaciones.filter((v) => v.fecha_fin !== null);
const usuario = persona.usuarios[0];
const idStr = String(persona.id);
```

Agregar:

```tsx
const kg30d = Number(cosecha30d._sum.peso_kg ?? 0);
const kgTotal = Number(cosechaTotal._sum.peso_kg ?? 0);
const arb30d = arboles30d._sum.cantidad_arboles ?? 0;
const arbTotal = arbolesTotal._sum.cantidad_arboles ?? 0;

const hayActividad =
  kgTotal > 0 || arbTotal > 0 || novedadesTotal > 0 || tareasTotal > 0;

const fmtKg = (n: number) =>
  n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("es-CO");
```

- [ ] **Step 3: Importar íconos Lucide necesarios**

En la línea de imports de lucide-react (línea 4), agregar los íconos que faltan: `TrendingUp` (cosecha), `Sprout` (árboles), `AlertCircle` (novedades), `CheckCircle2` (tareas).

Buscar:
```tsx
import { ChevronLeft, Pencil, Calendar, Phone, IdCard } from "lucide-react";
```

Reemplazar por:
```tsx
import {
  ChevronLeft,
  Pencil,
  Calendar,
  Phone,
  IdCard,
  TrendingUp,
  Sprout,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
```

- [ ] **Step 4: Agregar la sección JSX entre "Vinculación activa" e "Histórico"**

Buscar el cierre de la sección "Vinculación activa" (la sección que termina con `</section>` después de mostrar tipo, rol_finca, fechas, salario, tarifa).

Justo después del cierre de esa `</section>` y antes del bloque `{historial.length > 0 ? (...)` que renderiza el histórico, insertar:

```tsx
{/* Productividad */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="font-serif text-base text-zelanda-verde-900">
    Productividad
  </h2>
  <p className="mt-1 text-xs text-zelanda-verde-700">
    Últimos 30 días · acumulado total.
  </p>

  {hayActividad ? (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
        <div className="flex items-center gap-1.5 text-zelanda-verde-700">
          <TrendingUp className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wider">Cosecha</p>
        </div>
        <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
          {fmtKg(kg30d)} kg
        </p>
        <p className="text-xs text-zelanda-verde-700/70">
          {fmtKg(kgTotal)} kg total
        </p>
      </div>
      <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
        <div className="flex items-center gap-1.5 text-zelanda-verde-700">
          <Sprout className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wider">Árboles atendidos</p>
        </div>
        <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
          {fmtN(arb30d)}
        </p>
        <p className="text-xs text-zelanda-verde-700/70">
          {fmtN(arbTotal)} total
        </p>
      </div>
      <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
        <div className="flex items-center gap-1.5 text-zelanda-verde-700">
          <AlertCircle className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wider">Novedades</p>
        </div>
        <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
          {fmtN(novedades30d)}
        </p>
        <p className="text-xs text-zelanda-verde-700/70">
          {fmtN(novedadesTotal)} total
        </p>
      </div>
      <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
        <div className="flex items-center gap-1.5 text-zelanda-verde-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wider">Tareas completadas</p>
        </div>
        <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
          {fmtN(tareas30d)}
        </p>
        <p className="text-xs text-zelanda-verde-700/70">
          {fmtN(tareasTotal)} total
        </p>
      </div>
    </div>
  ) : (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">
      Sin actividad operativa registrada para esta persona.
    </p>
  )}
</section>
```

- [ ] **Step 5: Verificar build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`, sin errores TypeScript.

Si aparece error de tipos en `tipo_registro: { in: ["TRAMO", "SUELTOS"] }`, importar el enum o pasar `as const`. Probable que Prisma 6 lo acepte como literal string. Si no:

```ts
tipo_registro: { in: ["TRAMO", "SUELTOS"] as const },
```

- [ ] **Step 6: Commit + push**

```bash
git add "app/(app)/jefe/equipo/[id]/page.tsx"
git commit -m "feat(equipo): seccion productividad en ficha de persona con metricas 30d y total"
git push origin main
```

---

## Verificación final manual (después del deploy)

- [ ] Login como JEFE → `/jefe/equipo` → click en una persona con cosechas registradas (ej. un recolector).
- [ ] Ver sección "Productividad" entre "Vinculación activa" e "Histórico de vinculaciones".
- [ ] 4 tiles muestran cosecha (kg), árboles atendidos, novedades, tareas completadas.
- [ ] Cada tile tiene número grande (30d) y "X total" chico abajo.
- [ ] Verificar contra Supabase SQL Editor:
  ```sql
  -- Para una persona específica X:
  SELECT SUM(peso_kg) FROM cosechas WHERE persona_id = X AND fecha >= NOW() - INTERVAL '30 days';
  SELECT SUM(cantidad_arboles) FROM registros_avance WHERE persona_id = X AND tipo_registro IN ('TRAMO', 'SUELTOS');
  SELECT COUNT(*) FROM registros_avance WHERE persona_id = X AND tipo_registro = 'NOVEDAD';
  SELECT COUNT(*) FROM asignaciones WHERE persona_id = X AND estado = 'COMPLETADA';
  ```
  Los números deben coincidir.
- [ ] Para persona sin actividad (ej. familiar): ver mensaje "Sin actividad operativa registrada para esta persona." (NO los 4 tiles con ceros).
- [ ] El número de "árboles atendidos" NO incluye los registros tipo NOVEDAD (esos cuentan en "Novedades").
- [ ] Las tareas en estado PENDIENTE o EN_PROGRESO no se cuentan en "Tareas completadas".
- [ ] La página sigue funcionando normal: editar miembro, ver histórico, gestionar acceso.
