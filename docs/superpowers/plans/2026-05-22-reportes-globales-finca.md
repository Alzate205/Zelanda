# Reporte global de la finca — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una vista única `/jefe/reportes` que consolide cosecha, lotes, recolectores, insumos, miel y salidas a nivel finca, y enlazarla desde el dashboard del jefe.

**Architecture:** Server component dynamic en un solo `page.tsx`. Todas las queries en un `Promise.all`. Patrón visual idéntico a `/jefe/lotes/[id]/reporte` (tiles, barras `<div>` CSS, sin librerías de gráficos). Sección de miel solo se renderiza si hay datos.

**Tech Stack:** Next.js 15.5 App Router, React 19, Prisma 6.19, Tailwind, TypeScript. Sin migración SQL. Verificación manual (proyecto sin tests).

**Spec:** [`docs/superpowers/specs/2026-05-22-reportes-globales-finca-design.md`](../specs/2026-05-22-reportes-globales-finca-design.md)

---

## Convenciones de este plan

- Patrón existente: `/jefe/lotes/[id]/reporte/page.tsx` es la referencia visual y de queries. Los castings de `Decimal → string` y `BigInt → string` siguen ese patrón.
- Server actions o mutaciones: ninguna. Es vista de solo lectura.
- Cada task termina con: build implícito (al recargar dev server) + commit. Sin tests automatizados (`npm run build` se corre al final del plan).
- Trabajar en `main` directamente (consentimiento explícito del usuario).
- Commits en español, prefijo `feat:`.

## Archivos involucrados

```
app/(app)/jefe/
├── reportes/                                 [NUEVO]
│   └── page.tsx                              ← server component, dynamic, todas las secciones
└── _dashboard-cliente.tsx                    [MODIFICAR — Tarea 6]
                                              ← tarjeta "Reportes" en sección Configuración
```

Un solo archivo `page.tsx` para todas las secciones (sigue patrón del reporte por lote, que tiene 262 líneas en un solo archivo). Estimado: ~350-400 líneas al final del plan.

---

## Tarea 1: Esqueleto + Resumen acumulado (sección 1)

**Files:**
- Create: `app/(app)/jefe/reportes/page.tsx`

Crear el archivo nuevo con imports, `requerirUsuario`, primera query y las 4 tarjetas del resumen.

- [ ] **Step 1: Crear archivo con esqueleto + sección 1**

Crear `app/(app)/jefe/reportes/page.tsx`:

```tsx
import { TrendingUp, TrendingDown, Warehouse, ShoppingBag } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function PaginaReportes() {
  await requerirUsuario("JEFE");

  const [cosechasTotal, salidasTotal, stockRows] = await Promise.all([
    prisma.cosechas.aggregate({
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      _sum: { cantidad_kg: true },
    }),
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
  ]);

  const totalCosechaKg = Number(cosechasTotal._sum.peso_kg ?? 0);
  const nCosechas = cosechasTotal._count._all;
  const totalSalidasKg = Number(salidasTotal._sum.cantidad_kg ?? 0);
  const stockKg = Number(stockRows[0]?.stock_kg ?? 0);

  const fmtKg = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Reportes
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Reportes de la finca
        </h1>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Datos consolidados de todos los lotes y operaciones.
        </p>
      </header>

      {/* Sección 1: Resumen acumulado */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosecha total</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalCosechaKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <ShoppingBag className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosechas</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {nCosechas.toLocaleString("es-CO")}
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingDown className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Salidas totales</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalSalidasKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <Warehouse className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Stock actual</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(stockKg)} kg
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificación manual rápida (opcional, antes de commit)**

Si querés probar en dev: `npm run dev`, navegar a `/jefe/reportes` (como JEFE), ver 4 tiles con cifras (pueden ser 0 si la BD está vacía). No tirar errores en consola.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/jefe/reportes/page.tsx"
git commit -m "feat(jefe): vista de reportes con resumen acumulado de la finca"
```

---

## Tarea 2: Cosecha últimos 12 meses (sección 2)

**Files:**
- Modify: `app/(app)/jefe/reportes/page.tsx`

Agregar el query mensual y la sección JSX con barras.

- [ ] **Step 1: Agregar import del icono `BarChart3`**

En la línea de imports de lucide-react, agregar `BarChart3`:

```tsx
import { TrendingUp, TrendingDown, Warehouse, ShoppingBag, BarChart3 } from "lucide-react";
```

- [ ] **Step 2: Agregar query mensual al `Promise.all`**

Reemplazar el `Promise.all` actual por:

```tsx
const [cosechasTotal, salidasTotal, stockRows, cosechasMes] = await Promise.all([
  prisma.cosechas.aggregate({
    _count: { _all: true },
    _sum: { peso_kg: true },
  }),
  prisma.salidas_cosecha.aggregate({
    _sum: { cantidad_kg: true },
  }),
  prisma.$queryRaw<{ stock_kg: string }[]>`
    SELECT stock_kg::text FROM v_stock_almacen
  `,
  prisma.$queryRaw<{ ym: string; total_kg: string; n_cosechas: number }[]>`
    SELECT
      TO_CHAR(fecha, 'YYYY-MM')          AS ym,
      SUM(peso_kg)::text                  AS total_kg,
      COUNT(*)::int                       AS n_cosechas
    FROM cosechas
    WHERE fecha >= NOW() - INTERVAL '12 months'
    GROUP BY ym
    ORDER BY ym DESC
  `,
]);
```

- [ ] **Step 3: Agregar helper `fmtMes` después del helper `fmtKg`**

Después de la línea `const fmtKg = ...`, agregar:

```tsx
const fmtMes = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", {
    month: "short",
    year: "2-digit",
  });
};

const maxMes = cosechasMes.reduce(
  (m, r) => Math.max(m, Number(r.total_kg)),
  0,
);
```

- [ ] **Step 4: Agregar sección JSX antes del cierre `</div>` final**

Insertar inmediatamente antes del `</div>` que cierra el `<div className="space-y-6">`:

```tsx
{/* Sección 2: Cosecha últimos 12 meses */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
    <BarChart3 className="h-5 w-5" /> Cosecha — últimos 12 meses
  </h2>
  {cosechasMes.length === 0 ? (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">
      Sin cosechas en los últimos 12 meses.
    </p>
  ) : (
    <ul className="mt-3 space-y-2">
      {cosechasMes.map((r) => {
        const v = Number(r.total_kg);
        const pct = maxMes > 0 ? (v / maxMes) * 100 : 0;
        return (
          <li key={r.ym} className="text-sm">
            <div className="flex items-center justify-between text-xs text-zelanda-verde-700/70">
              <span>{fmtMes(r.ym)}</span>
              <span>
                {fmtKg(v)} kg · {r.n_cosechas} cosecha
                {r.n_cosechas === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zelanda-beige-200">
              <div
                className="h-full rounded-full bg-zelanda-verde-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  )}
</section>
```

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/jefe/reportes/page.tsx"
git commit -m "feat(jefe): reporte muestra cosecha consolidada de ultimos 12 meses"
```

---

## Tarea 3: Ranking de lotes (sección 3)

**Files:**
- Modify: `app/(app)/jefe/reportes/page.tsx`

Agregar query con LEFT JOIN sobre lotes y la lista con kg total / kg/árbol / kg/ha.

- [ ] **Step 1: Agregar query al `Promise.all`**

Agregar al final del array del `Promise.all`:

```tsx
prisma.$queryRaw<{
  id: bigint;
  nombre: string;
  total_arboles: number;
  hectareas: string | null;
  kg_total: string;
}[]>`
  SELECT
    l.id,
    l.nombre,
    l.total_arboles,
    l.hectareas::text       AS hectareas,
    COALESCE(SUM(c.peso_kg), 0)::text AS kg_total
  FROM lotes l
  LEFT JOIN cosechas c ON c.lote_id = l.id
  WHERE l.deleted_at IS NULL
  GROUP BY l.id, l.nombre, l.total_arboles, l.hectareas
  ORDER BY SUM(c.peso_kg) DESC NULLS LAST, l.nombre ASC
`,
```

Y agregar `rankingLotes` al destructuring:

```tsx
const [cosechasTotal, salidasTotal, stockRows, cosechasMes, rankingLotes] = await Promise.all([
```

- [ ] **Step 2: Calcular `maxLote` antes del JSX**

Después del `const maxMes = ...`:

```tsx
const maxLote = rankingLotes.reduce(
  (m, r) => Math.max(m, Number(r.kg_total)),
  0,
);
```

- [ ] **Step 3: Agregar sección JSX (después de la sección 2, antes del cierre `</div>`)**

```tsx
{/* Sección 3: Ranking de lotes */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="font-serif text-lg text-zelanda-verde-900">
    Ranking de lotes
  </h2>
  <p className="mt-1 text-xs text-zelanda-verde-700/70">
    Ordenados por cosecha acumulada. Métricas derivadas cuando hay árboles y hectáreas.
  </p>
  <ul className="mt-3 space-y-2">
    {rankingLotes.map((l) => {
      const kg = Number(l.kg_total);
      const pct = maxLote > 0 ? (kg / maxLote) * 100 : 0;
      const kgArbol = l.total_arboles > 0 ? kg / l.total_arboles : null;
      const hect = l.hectareas ? Number(l.hectareas) : 0;
      const kgHa = hect > 0 ? kg / hect : null;
      return (
        <li key={l.id.toString()} className="text-sm">
          <div className="flex items-center justify-between gap-2 text-zelanda-verde-900">
            <span className="font-medium">{l.nombre}</span>
            <span className="font-serif">{fmtKg(kg)} kg</span>
          </div>
          <div className="mt-0.5 text-xs text-zelanda-verde-700/70">
            {kgArbol !== null
              ? `${kgArbol.toFixed(2)} kg/árbol`
              : "— kg/árbol"}
            {" · "}
            {kgHa !== null
              ? `${kgHa.toFixed(2)} kg/ha`
              : "— kg/ha"}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zelanda-beige-200">
            <div
              className="h-full rounded-full bg-zelanda-verde-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </li>
      );
    })}
  </ul>
</section>
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/reportes/page.tsx"
git commit -m "feat(jefe): ranking de los 15 lotes por kg total con kg/arbol y kg/ha"
```

---

## Tarea 4: Top 10 recolectores + Insumos consumidos (secciones 4 y 5)

**Files:**
- Modify: `app/(app)/jefe/reportes/page.tsx`

Dos secciones similares (listas simples). Las hago en una sola tarea.

- [ ] **Step 1: Agregar las dos queries al `Promise.all`**

Agregar al final del array:

```tsx
prisma.$queryRaw<{
  persona_id: bigint;
  nombre_completo: string;
  total_kg: string;
  n_cosechas: number;
}[]>`
  SELECT
    c.persona_id,
    p.nombre_completo,
    SUM(c.peso_kg)::text    AS total_kg,
    COUNT(c.id)::int        AS n_cosechas
  FROM cosechas c
  JOIN personas p ON p.id = c.persona_id
  GROUP BY c.persona_id, p.nombre_completo
  ORDER BY SUM(c.peso_kg) DESC
  LIMIT 10
`,
prisma.$queryRaw<{
  insumo_id: bigint;
  nombre: string;
  unidad: string;
  total: string;
}[]>`
  SELECT
    i.id                                AS insumo_id,
    i.nombre,
    i.unidad,
    SUM(di.cantidad_consumida)::text    AS total
  FROM despacho_items di
  JOIN insumos i ON i.id = di.insumo_id
  WHERE di.tipo_item = 'INSUMO'
    AND di.cantidad_consumida IS NOT NULL
    AND di.cantidad_consumida > 0
  GROUP BY i.id, i.nombre, i.unidad
  ORDER BY SUM(di.cantidad_consumida) DESC
`,
```

Y al destructuring:

```tsx
const [
  cosechasTotal,
  salidasTotal,
  stockRows,
  cosechasMes,
  rankingLotes,
  topRecolectores,
  insumosConsumidos,
] = await Promise.all([
```

- [ ] **Step 2: Agregar import del icono `FlaskConical`**

```tsx
import { TrendingUp, TrendingDown, Warehouse, ShoppingBag, BarChart3, FlaskConical } from "lucide-react";
```

- [ ] **Step 3: Agregar las dos secciones JSX**

Después de la sección 3, antes del cierre `</div>` final:

```tsx
{/* Sección 4: Top recolectores de la finca */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="font-serif text-lg text-zelanda-verde-900">
    Top recolectores
  </h2>
  {topRecolectores.length === 0 ? (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">
      Sin recolectores registrados.
    </p>
  ) : (
    <ul className="mt-3 divide-y divide-zelanda-beige-200">
      {topRecolectores.map((r) => (
        <li
          key={r.persona_id.toString()}
          className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-zelanda-verde-900">
              {r.nombre_completo}
            </p>
            <p className="text-xs text-zelanda-verde-700/70">
              {r.n_cosechas} cosecha{r.n_cosechas === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-right font-serif text-zelanda-verde-900">
            {fmtKg(Number(r.total_kg))} kg
          </p>
        </li>
      ))}
    </ul>
  )}
</section>

{/* Sección 5: Insumos consumidos (finca) */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
    <FlaskConical className="h-5 w-5" /> Insumos consumidos
  </h2>
  <p className="mt-1 text-xs text-zelanda-verde-700/70">
    Suma de <code>cantidad_consumida</code> en todos los despachos cerrados.
  </p>
  {insumosConsumidos.length === 0 ? (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">
      Sin insumos consumidos.
    </p>
  ) : (
    <ul className="mt-3 divide-y divide-zelanda-beige-200">
      {insumosConsumidos.map((c) => (
        <li
          key={c.insumo_id.toString()}
          className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
        >
          <span className="truncate font-medium text-zelanda-verde-900">
            {c.nombre}
          </span>
          <span className="text-right font-serif text-zelanda-verde-900">
            {Number(c.total).toLocaleString("es-CO", {
              maximumFractionDigits: 3,
            })}{" "}
            {c.unidad}
          </span>
        </li>
      ))}
    </ul>
  )}
</section>
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/reportes/page.tsx"
git commit -m "feat(jefe): top recolectores y consumo de insumos a nivel finca"
```

---

## Tarea 5: Miel condicional + Salidas por tipo (secciones 6 y 7)

**Files:**
- Modify: `app/(app)/jefe/reportes/page.tsx`

Dos secciones más. Miel se renderiza solo con datos. Salidas tiene barras + badges.

- [ ] **Step 1: Agregar queries de miel + salidas al `Promise.all`**

Agregar al final del array:

```tsx
prisma.cosechas_miel.aggregate({
  _sum: { kg: true },
  _count: { _all: true },
}),
prisma.$queryRaw<{ nombre: string; total_kg: string }[]>`
  SELECT a.nombre, SUM(cm.kg)::text AS total_kg
  FROM cosechas_miel cm
  JOIN apiarios a ON a.id = cm.apiario_id
  GROUP BY a.id, a.nombre
  ORDER BY SUM(cm.kg) DESC
`,
prisma.$queryRaw<{
  persona_id: bigint;
  nombre_completo: string;
  total_kg: string;
}[]>`
  SELECT cm.persona_id, p.nombre_completo, SUM(cm.kg)::text AS total_kg
  FROM cosechas_miel cm
  JOIN personas p ON p.id = cm.persona_id
  GROUP BY cm.persona_id, p.nombre_completo
  ORDER BY SUM(cm.kg) DESC
  LIMIT 5
`,
prisma.$queryRaw<{ tipo: string; total_kg: string; n_salidas: number }[]>`
  SELECT tipo::text                  AS tipo,
         SUM(cantidad_kg)::text       AS total_kg,
         COUNT(*)::int                AS n_salidas
  FROM salidas_cosecha
  WHERE fecha >= NOW() - INTERVAL '12 months'
  GROUP BY tipo
  ORDER BY SUM(cantidad_kg) DESC
`,
```

Y al destructuring:

```tsx
const [
  cosechasTotal,
  salidasTotal,
  stockRows,
  cosechasMes,
  rankingLotes,
  topRecolectores,
  insumosConsumidos,
  mielTotal,
  rankingApiarios,
  topRecolectoresMiel,
  salidasPorTipo,
] = await Promise.all([
```

- [ ] **Step 2: Pre-cálculos antes del JSX**

Después de `const maxLote = ...`:

```tsx
const totalMielKg = Number(mielTotal._sum.kg ?? 0);
const hayMiel = mielTotal._count._all > 0;

const totalSalidas12m = salidasPorTipo.reduce(
  (s, r) => s + Number(r.total_kg),
  0,
);
const maxSalida = salidasPorTipo.reduce(
  (m, r) => Math.max(m, Number(r.total_kg)),
  0,
);

const TONO_TIPO_SALIDA: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};
```

- [ ] **Step 3: Agregar las dos secciones JSX**

Después de la sección 5, antes del cierre `</div>` final:

```tsx
{/* Sección 6: Miel — solo si hay datos */}
{hayMiel ? (
  <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
    <h2 className="font-serif text-lg text-zelanda-verde-900">
      Apicultura — miel
    </h2>
    <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
      {fmtKg(totalMielKg)} kg
    </p>
    <p className="text-xs text-zelanda-verde-700/70">
      {mielTotal._count._all} cosecha{mielTotal._count._all === 1 ? "" : "s"} de miel
    </p>

    {rankingApiarios.length > 0 ? (
      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-wider text-zelanda-verde-700">
          Por apiario
        </h3>
        <ul className="mt-2 divide-y divide-zelanda-beige-200">
          {rankingApiarios.map((a) => (
            <li
              key={a.nombre}
              className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
            >
              <span className="truncate font-medium text-zelanda-verde-900">
                {a.nombre}
              </span>
              <span className="text-right font-serif text-zelanda-verde-900">
                {fmtKg(Number(a.total_kg))} kg
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}

    {topRecolectoresMiel.length > 0 ? (
      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-wider text-zelanda-verde-700">
          Top recolectores de miel
        </h3>
        <ul className="mt-2 divide-y divide-zelanda-beige-200">
          {topRecolectoresMiel.map((r) => (
            <li
              key={r.persona_id.toString()}
              className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
            >
              <span className="truncate font-medium text-zelanda-verde-900">
                {r.nombre_completo}
              </span>
              <span className="text-right font-serif text-zelanda-verde-900">
                {fmtKg(Number(r.total_kg))} kg
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </section>
) : null}

{/* Sección 7: Salidas por tipo (últimos 12 meses) */}
<section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
  <h2 className="font-serif text-lg text-zelanda-verde-900">
    Salidas del almacén — últimos 12 meses
  </h2>
  {salidasPorTipo.length === 0 ? (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">
      Sin salidas registradas en los últimos 12 meses.
    </p>
  ) : (
    <ul className="mt-3 space-y-3">
      {salidasPorTipo.map((s) => {
        const kg = Number(s.total_kg);
        const pct = maxSalida > 0 ? (kg / maxSalida) * 100 : 0;
        const pctTotal =
          totalSalidas12m > 0 ? (kg / totalSalidas12m) * 100 : 0;
        return (
          <li key={s.tipo} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO_SALIDA[s.tipo] ?? ""}`}
              >
                {s.tipo}
              </span>
              <span className="font-serif text-zelanda-verde-900">
                {fmtKg(kg)} kg
              </span>
            </div>
            <div className="mt-0.5 text-xs text-zelanda-verde-700/70">
              {pctTotal.toFixed(1)}% del total · {s.n_salidas} salida
              {s.n_salidas === 1 ? "" : "s"}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zelanda-beige-200">
              <div
                className="h-full rounded-full bg-zelanda-verde-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  )}
</section>
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/reportes/page.tsx"
git commit -m "feat(jefe): seccion de miel condicional y desglose de salidas por tipo"
```

---

## Tarea 6: Tarjeta en dashboard + build + push

**Files:**
- Modify: `app/(app)/jefe/_dashboard-cliente.tsx`

Enlazar `/jefe/reportes` desde el dashboard del jefe en la sección "Configuración" que ya tiene "Tipos de tarea".

- [ ] **Step 1: Agregar tarjeta "Reportes" al dashboard**

Editar `app/(app)/jefe/_dashboard-cliente.tsx`. Buscar el bloque que tiene la tarjeta "Tipos de tarea":

```tsx
<Link
  href="/jefe/tareas"
  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
>
  <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
    Tipos de tarea
  </p>
  <p className="mt-1 font-serif text-base text-zelanda-verde-900">
    Frecuencias y catálogo
  </p>
</Link>
```

Justo después de ese `</Link>`, agregar:

```tsx
<Link
  href="/jefe/reportes"
  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
>
  <p className="text-xs uppercase tracking-wider text-zelanda-verde-700">
    Reportes
  </p>
  <p className="mt-1 font-serif text-base text-zelanda-verde-900">
    Cosecha, lotes, recolectores
  </p>
</Link>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: termina con "Compiled successfully" y la ruta `/jefe/reportes` aparece en la lista de rutas dynamic.

Si hay errores de TS: revisar tipos (probable casting de `BigInt`/`Decimal`).

- [ ] **Step 3: Commit + push**

```bash
git add "app/(app)/jefe/_dashboard-cliente.tsx"
git commit -m "feat(jefe): tarjeta reportes en dashboard para acceder al reporte global"
git push origin main
```

---

## Verificación final manual

Después del deploy en Vercel:

- [ ] Login como JEFE → dashboard `/jefe`.
- [ ] Sección "Configuración" muestra dos tarjetas: "Tipos de tarea" y "Reportes".
- [ ] Click "Reportes" → carga `/jefe/reportes` sin errores en consola.
- [ ] Las 4 tarjetas del resumen muestran números coherentes con BD (cosecha total, # cosechas, salidas, stock).
- [ ] La sección de 12 meses muestra barras si hay cosechas recientes (o placeholder si no).
- [ ] Los 15 lotes aparecen en el ranking, ordenados por kg desc. Lotes sin cosechas muestran 0 kg + "—" en kg/árbol y kg/ha.
- [ ] Top recolectores: hasta 10 personas, ordenadas por kg desc.
- [ ] Insumos consumidos: lista o placeholder si no hay despachos cerrados con `cantidad_consumida`.
- [ ] Miel: si hay cosechas en `cosechas_miel`, sección visible con total kg + por apiario + top 5 recolectores. Si no, sección **no aparece** (no muestra placeholder vacío).
- [ ] Salidas por tipo: si hay salidas en últimos 12 meses, los tipos aparecen con badges, kg, % y barras.
- [ ] Probar como TRABAJADOR / BODEGA / ALMACEN: intentar `/jefe/reportes` → redirige a su propio dashboard (comportamiento de `requerirUsuario("JEFE")`).
