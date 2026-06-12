# Trazabilidad v2 (ficha técnica + carencia): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ficha técnica del químico en el catálogo de insumos (ingrediente activo, registro ICA, carencia, reingreso) y alerta de periodo de carencia en tres puntos: formulario de cosecha del almacén (con push al jefe si se registra igual), panel del lote en el mapa y wizard de asignación de tareas de cosecha.

**Architecture:** Spec en `docs/superpowers/specs/2026-06-12-ficha-tecnica-carencia-design.md`. Una sola fuente de carencias: `lib/carencia.ts` (cálculo puro testeado) + `lib/jefe/carencias.ts` (`carenciasActivas()` cacheada 5 min) consumida por almacén, snapshot del jefe y wizard. Nada bloquea: solo avisa.

**Tech Stack:** Prisma + PostgreSQL (Supabase), Next.js App Router, vitest, web-push existente.

---

### Task 1: Migración SQL + schema Prisma

**Files:**

- Create: `supabase/migracion-ficha-tecnica.sql`
- Modify: `prisma/schema.prisma` (`model insumos`)

- [ ] **Step 1: Escribir la migración**

`supabase/migracion-ficha-tecnica.sql`:

```sql
-- ============================================================
-- Ficha técnica del químico en insumos (trazabilidad v2).
-- Ver docs/superpowers/specs/2026-06-12-ficha-tecnica-carencia-design.md
-- ============================================================

BEGIN;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS ingrediente_activo TEXT NULL,
  ADD COLUMN IF NOT EXISTS registro_ica TEXT NULL,
  ADD COLUMN IF NOT EXISTS periodo_carencia_dias INTEGER NULL,
  ADD COLUMN IF NOT EXISTS periodo_reingreso_horas INTEGER NULL;

COMMIT;
```

- [ ] **Step 2: Espejar en `prisma/schema.prisma`**

En `model insumos`, después de `costo_unitario`:

```prisma
  ingrediente_activo      String?
  registro_ica            String?
  periodo_carencia_dias   Int?
  periodo_reingreso_horas Int?
```

- [ ] **Step 3: Regenerar y verificar**

Run: `npx prisma generate` → `Generated Prisma Client`
Run: `npm run check:types` → sin errores

- [ ] **Step 4: CHECKPOINT — Samuel ejecuta la migración en Supabase → SQL Editor.** (Las tareas 2–6 compilan y testean sin la BD.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migracion-ficha-tecnica.sql prisma/schema.prisma
git commit -m "feat: ficha tecnica del quimico en insumos (columnas)"
```

---

### Task 2: Cálculo puro `lib/carencia.ts` (TDD)

**Files:**

- Create: `lib/carencia.ts`
- Test: `lib/carencia.test.ts`

- [ ] **Step 1: Test que falla**

`lib/carencia.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { carenciasPorLote, fmtCarenciaHasta } from './carencia';

const apl = (lote_id: string, insumo: string, fecha: string, dias: number) => ({
  lote_id,
  insumo,
  fecha_aplicacion: new Date(`${fecha}T12:00:00-05:00`),
  carencia_dias: dias,
});

describe('carenciasPorLote', () => {
  it('una aplicación reciente genera carencia activa', () => {
    const r = carenciasPorLote([apl('1', 'Glifosato', '2026-06-10', 14)], '2026-06-12');
    expect(r).toEqual([{ lote_id: '1', insumo: 'Glifosato', hasta: '2026-06-24' }]);
  });
  it('una carencia vencida ayer no aparece', () => {
    expect(carenciasPorLote([apl('1', 'Glifosato', '2026-06-01', 10)], '2026-06-12')).toEqual([]);
  });
  it('el día exacto en que termina todavía está activa', () => {
    const r = carenciasPorLote([apl('1', 'Glifosato', '2026-06-02', 10)], '2026-06-12');
    expect(r[0]?.hasta).toBe('2026-06-12');
  });
  it('dos aplicaciones en el mismo lote: gana la que llega más lejos', () => {
    const r = carenciasPorLote(
      [apl('1', 'Glifosato', '2026-06-10', 5), apl('1', 'Clorpirifos', '2026-06-08', 21)],
      '2026-06-12'
    );
    expect(r).toEqual([{ lote_id: '1', insumo: 'Clorpirifos', hasta: '2026-06-29' }]);
  });
  it('carencia 0 o negativa no participa', () => {
    expect(carenciasPorLote([apl('1', 'Cal agrícola', '2026-06-12', 0)], '2026-06-12')).toEqual([]);
  });
});

describe('fmtCarenciaHasta', () => {
  it('formatea YYYY-MM-DD como DD/MM', () => {
    expect(fmtCarenciaHasta('2026-06-24')).toBe('24/06');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/carencia.test.ts` → FAIL (`Cannot find module './carencia'`)

- [ ] **Step 3: Implementación**

`lib/carencia.ts`:

```ts
// Cálculo puro del periodo de carencia (días sin cosechar tras una
// aplicación química). Todas las fechas se comparan por día de Bogotá.

export type AplicacionConCarencia = {
  lote_id: string;
  insumo: string;
  fecha_aplicacion: Date;
  carencia_dias: number;
};

export type CarenciaLote = {
  lote_id: string;
  insumo: string;
  /** Último día de la carencia (inclusive), YYYY-MM-DD. */
  hasta: string;
};

function diaBogota(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

function sumarDias(dia: string, dias: number): string {
  const [a, m, dd] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dd + dias)).toISOString().slice(0, 10);
}

/** Por lote, la carencia activa que más lejos llega. `hoy` en YYYY-MM-DD (Bogotá). */
export function carenciasPorLote(
  aplicaciones: AplicacionConCarencia[],
  hoy: string
): CarenciaLote[] {
  const porLote = new Map<string, CarenciaLote>();
  for (const a of aplicaciones) {
    if (a.carencia_dias <= 0) continue;
    const hasta = sumarDias(diaBogota(a.fecha_aplicacion), a.carencia_dias);
    if (hasta < hoy) continue;
    const previa = porLote.get(a.lote_id);
    if (!previa || hasta > previa.hasta) {
      porLote.set(a.lote_id, { lote_id: a.lote_id, insumo: a.insumo, hasta });
    }
  }
  return [...porLote.values()];
}

/** '2026-06-24' → '24/06' para mostrar en banners y push. */
export function fmtCarenciaHasta(hasta: string): string {
  const [, m, d] = hasta.split('-');
  return `${d}/${m}`;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run lib/carencia.test.ts` → 6 passed

- [ ] **Step 5: Commit**

```bash
git add lib/carencia.ts lib/carencia.test.ts
git commit -m "feat: calculo puro del periodo de carencia por lote"
```

---

### Task 3: Server `lib/jefe/carencias.ts` + tipo del snapshot

**Files:**

- Create: `lib/jefe/carencias.ts`
- Modify: `lib/offline/tipos.ts` (junto a `PrediccionLoteResumen` y los opcionales de `SnapshotJefe`)

- [ ] **Step 1: Server query**

`lib/jefe/carencias.ts`:

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { carenciasPorLote, type CarenciaLote } from '@/lib/carencia';

const obtenerCarenciasUncached = async (): Promise<CarenciaLote[]> => {
  // 90 días cubre cualquier carencia razonable (las etiquetas van de 1 a ~30 días).
  const desde = new Date(Date.now() - 90 * 86400000);
  const items = await prisma.despacho_items.findMany({
    where: {
      tipo_item: 'INSUMO',
      cantidad_consumida: { gt: 0 },
      insumos: { periodo_carencia_dias: { gt: 0 } },
      despachos: { estado: 'CERRADO', lote_id: { not: null }, fecha: { gte: desde } },
    },
    select: {
      insumos: { select: { nombre: true, periodo_carencia_dias: true } },
      despachos: { select: { fecha: true, lote_id: true } },
    },
  });

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  return carenciasPorLote(
    items.map((it) => ({
      lote_id: it.despachos.lote_id!.toString(),
      insumo: it.insumos?.nombre ?? '?',
      fecha_aplicacion: it.despachos.fecha,
      carencia_dias: it.insumos?.periodo_carencia_dias ?? 0,
    })),
    hoy
  );
};

/** Lotes en carencia activa. Cache corto: una ventana de días tolera 5 min. */
export const carenciasActivas = unstable_cache(obtenerCarenciasUncached, ['carencias-activas'], {
  revalidate: 300,
});
```

- [ ] **Step 2: Tipo en `lib/offline/tipos.ts`**

Junto a `PrediccionLoteResumen`:

```ts
export type CarenciaLoteResumen = {
  lote_id: string;
  insumo: string;
  hasta: string; // YYYY-MM-DD, último día inclusive
};
```

Y en `SnapshotJefe`, junto a los otros opcionales (`prediccion_por_lote?`):

```ts
  carencias_por_lote?: CarenciaLoteResumen[];
```

- [ ] **Step 3: Verificar** — `npm run check:types` y `npm run lint` limpios.

- [ ] **Step 4: Commit**

```bash
git add lib/jefe/carencias.ts lib/offline/tipos.ts
git commit -m "feat: consulta de carencias activas por lote"
```

---

### Task 4: Ficha técnica en bodega (formulario + acciones + detalle)

**Files:**

- Modify: `app/(app)/bodega/inventario/insumos/_formulario.tsx`
- Modify: `app/(app)/bodega/inventario/acciones.ts` (funciones `crearInsumo` y `actualizarInsumo`, líneas ~130–245)
- Modify: `app/(app)/bodega/inventario/insumos/[id]/page.tsx`
- Modify: `app/(app)/bodega/inventario/insumos/[id]/editar/page.tsx` (pasar los valores nuevos al formulario)

- [ ] **Step 1: Campos en el formulario**

En `_formulario.tsx`, extender `Valores`:

```ts
type Valores = {
  id?: string;
  nombre: string;
  categoria: 'CULTIVO' | 'COSECHA' | 'APICULTURA';
  unidad: string;
  stock_minimo: string;
  costo_unitario: string | null;
  ingrediente_activo: string | null;
  registro_ica: string | null;
  periodo_carencia_dias: string | null;
  periodo_reingreso_horas: string | null;
};
```

Y después del `<div>` de `costo_unitario` (antes del bloque de error), la sección nueva (mismas clases de input que los campos existentes — copialas del campo `nombre`):

```tsx
<fieldset className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-zelanda-beige-50/60 p-3">
  <legend className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
    Ficha técnica (químicos) — opcional
  </legend>
  <div>
    <label
      htmlFor="ingrediente_activo"
      className="block text-sm font-medium text-zelanda-verde-900"
    >
      Ingrediente activo
    </label>
    <input
      id="ingrediente_activo"
      name="ingrediente_activo"
      placeholder="Ej: Glifosato 480 g/L"
      defaultValue={valores?.ingrediente_activo ?? ''}
      className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
    />
  </div>
  <div>
    <label htmlFor="registro_ica" className="block text-sm font-medium text-zelanda-verde-900">
      Registro ICA
    </label>
    <input
      id="registro_ica"
      name="registro_ica"
      defaultValue={valores?.registro_ica ?? ''}
      className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
    />
  </div>
  <div className="grid grid-cols-2 gap-2.5">
    <div>
      <label
        htmlFor="periodo_carencia_dias"
        className="block text-sm font-medium text-zelanda-verde-900"
      >
        Carencia (días)
      </label>
      <input
        id="periodo_carencia_dias"
        name="periodo_carencia_dias"
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        defaultValue={valores?.periodo_carencia_dias ?? ''}
        className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
      />
    </div>
    <div>
      <label
        htmlFor="periodo_reingreso_horas"
        className="block text-sm font-medium text-zelanda-verde-900"
      >
        Reingreso (horas)
      </label>
      <input
        id="periodo_reingreso_horas"
        name="periodo_reingreso_horas"
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        defaultValue={valores?.periodo_reingreso_horas ?? ''}
        className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
      />
    </div>
  </div>
  <p className="m-0 text-[10.5px] text-zelanda-verde-700">
    Días sin cosechar / horas sin entrar al lote después de aplicar, según la etiqueta del producto.
  </p>
</fieldset>
```

- [ ] **Step 2: Parsear y persistir en `acciones.ts`**

En `crearInsumo` y `actualizarInsumo`, después del parseo de `costoRaw`, agregar (idéntico en ambas):

```ts
const ingredienteActivo = String(formData.get('ingrediente_activo') ?? '').trim() || null;
const registroIca = String(formData.get('registro_ica') ?? '').trim() || null;

function parsearEnteroOpcional(raw: string): { ok: true; valor: number | null } | { ok: false } {
  if (!raw) return { ok: true, valor: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { ok: false };
  return { ok: true, valor: n };
}
const carenciaParse = parsearEnteroOpcional(
  String(formData.get('periodo_carencia_dias') ?? '').trim()
);
if (!carenciaParse.ok) return { error: 'Carencia debe ser un entero ≥ 0 (días).' };
const reingresoParse = parsearEnteroOpcional(
  String(formData.get('periodo_reingreso_horas') ?? '').trim()
);
if (!reingresoParse.ok) return { error: 'Reingreso debe ser un entero ≥ 0 (horas).' };
```

(Nota: si preferís, definí `parsearEnteroOpcional` UNA vez a nivel de módulo en `acciones.ts` en vez de dentro de cada función — eso es lo correcto; el bloque de arriba muestra la lógica.)

Y en los `data` de `prisma.insumos.create` / `prisma.insumos.update`:

```ts
ingrediente_activo: ingredienteActivo,
registro_ica: registroIca,
periodo_carencia_dias: carenciaParse.valor,
periodo_reingreso_horas: reingresoParse.valor,
```

- [ ] **Step 3: Editar precarga los valores**

En `insumos/[id]/editar/page.tsx`, donde arma `valores` para el formulario, agregar:

```ts
ingrediente_activo: insumo.ingrediente_activo,
registro_ica: insumo.registro_ica,
periodo_carencia_dias:
  insumo.periodo_carencia_dias != null ? String(insumo.periodo_carencia_dias) : null,
periodo_reingreso_horas:
  insumo.periodo_reingreso_horas != null ? String(insumo.periodo_reingreso_horas) : null,
```

(y que la query del insumo traiga las 4 columnas; si usa `findUnique` sin `select`, ya vienen.)

- [ ] **Step 4: Bloque en el detalle del insumo**

En `insumos/[id]/page.tsx` (leer el archivo y seguir el estilo de cards existente), después del bloque de stock:

```tsx
{
  insumo.ingrediente_activo ||
  insumo.registro_ica ||
  insumo.periodo_carencia_dias != null ||
  insumo.periodo_reingreso_horas != null ? (
    <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
      <h2 className="font-serif text-base text-zelanda-verde-900">Ficha técnica</h2>
      <dl className="mt-2 space-y-1.5 text-sm">
        {insumo.ingrediente_activo ? (
          <div className="flex justify-between gap-2">
            <dt className="text-zelanda-verde-700">Ingrediente activo</dt>
            <dd className="m-0 text-right text-zelanda-verde-900">{insumo.ingrediente_activo}</dd>
          </div>
        ) : null}
        {insumo.registro_ica ? (
          <div className="flex justify-between gap-2">
            <dt className="text-zelanda-verde-700">Registro ICA</dt>
            <dd className="m-0 text-right text-zelanda-verde-900">{insumo.registro_ica}</dd>
          </div>
        ) : null}
        {insumo.periodo_carencia_dias != null ? (
          <div className="flex justify-between gap-2">
            <dt className="text-zelanda-verde-700">Carencia</dt>
            <dd className="m-0 text-right text-zelanda-verde-900">
              {insumo.periodo_carencia_dias} días sin cosechar
            </dd>
          </div>
        ) : null}
        {insumo.periodo_reingreso_horas != null ? (
          <div className="flex justify-between gap-2">
            <dt className="text-zelanda-verde-700">Reingreso</dt>
            <dd className="m-0 text-right text-zelanda-verde-900">
              {insumo.periodo_reingreso_horas} h sin entrar al lote
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  ) : null;
}
```

(Ajustar el wrapper a los componentes de la página — si usa `<Card>`, usar `<Card>`.)

- [ ] **Step 5: Verificar** — `npm run lint`, `npm run check:types` limpios.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/bodega/inventario/insumos/_formulario.tsx" "app/(app)/bodega/inventario/acciones.ts" "app/(app)/bodega/inventario/insumos/[id]/page.tsx" "app/(app)/bodega/inventario/insumos/[id]/editar/page.tsx"
git commit -m "feat: ficha tecnica del quimico en el catalogo de insumos"
```

---

### Task 5: Almacén — banner de carencia + push al jefe

**Files:**

- Modify: `app/(app)/almacen/cosecha/nueva/_formulario.tsx` (FormularioCosecha)
- Modify: `app/(app)/almacen/cosecha/nueva/page.tsx`
- Modify: `app/(app)/almacen/page.tsx` (el home también monta `FormularioCosechaWrapper`)
- Modify: `app/api/almacen/cosecha/route.ts`

- [ ] **Step 1: Prop + banner en `FormularioCosecha`**

Nueva prop (con default para no romper otros usos):

```ts
carencias = [],
```

con tipo en la firma:

```ts
carencias?: { lote_id: string; insumo: string; hasta: string }[];
```

Import arriba: `import { fmtCarenciaHasta } from '@/lib/carencia';` y `AlertTriangle` de lucide-react (sumarlo al import existente).

Derivado, después de `pesoCalculado`:

```ts
const carenciaSel = loteId ? carencias.find((c) => c.lote_id === loteId) ?? null : null;
```

Banner — inmediatamente después del `<div className="grid grid-cols-2 gap-2.5">` que contiene Lote/Recolector (es decir, como bloque hermano siguiente):

```tsx
{
  carenciaSel ? (
    <p className="flex items-start gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-[13px] text-zelanda-ocre-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Este lote está en carencia hasta el {fmtCarenciaHasta(carenciaSel.hasta)} por{' '}
        {carenciaSel.insumo} — la fruta podría no ser apta.
      </span>
    </p>
  ) : null;
}
```

(No bloquea: el submit sigue igual.)

- [ ] **Step 2: Las dos páginas pasan las carencias**

`app/(app)/almacen/cosecha/nueva/page.tsx`: importar `carenciasActivas` de `@/lib/jefe/carencias`, sumarlo al `Promise.all` existente como cuarto elemento (`carencias`), y pasar `carencias={carencias}` al `<FormularioCosecha>`.

`app/(app)/almacen/page.tsx`: igual — importar `carenciasActivas`, obtenerlas junto a las queries existentes y pasar `carencias={carencias}` al `<FormularioCosechaWrapper ... />`.

(`carenciasActivas` ya devuelve los tipos string serializables.)

- [ ] **Step 3: Push al jefe en la API**

En `app/api/almacen/cosecha/route.ts`, imports nuevos:

```ts
import { carenciasActivas } from '@/lib/jefe/carencias';
import { fmtCarenciaHasta } from '@/lib/carencia';
import { enviarPushAUsuarios } from '@/lib/push/enviar';
```

Después del `prisma.cosechas.create` exitoso y ANTES del `return NextResponse.json({ ok: true, ... })` (dentro del try, después de los revalidates):

```ts
// Si el lote está en carencia, avisar a los jefes. El push nunca tumba el registro.
try {
  const carencia = (await carenciasActivas()).find((c) => c.lote_id === body.lote_id);
  if (carencia) {
    const [lote, jefes] = await Promise.all([
      prisma.lotes.findUnique({ where: { id: BigInt(body.lote_id) }, select: { nombre: true } }),
      prisma.usuarios.findMany({ where: { rol: 'JEFE', activo: true }, select: { id: true } }),
    ]);
    if (jefes.length > 0) {
      await enviarPushAUsuarios(
        jefes.map((j) => j.id),
        {
          titulo: 'Cosecha en periodo de carencia',
          cuerpo: `${lote?.nombre ?? 'Lote'}: ${
            carencia.insumo
          }, carencia hasta el ${fmtCarenciaHasta(carencia.hasta)}`,
          url: '/jefe/aplicaciones',
          tag: 'cosecha-carencia',
        }
      );
    }
  }
} catch (e) {
  console.warn('Push carencia falló:', e);
}
```

Antes de usar `enviarPushAUsuarios`, leer `lib/push/enviar.ts` para confirmar la firma (es la misma que usa `lib/push/alerta-clima.ts`). Si difiere, adaptar la llamada.

- [ ] **Step 4: Verificar** — `npm run lint`, `npm run check:types`, `npm run test` limpios.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/almacen/cosecha/nueva/_formulario.tsx" "app/(app)/almacen/cosecha/nueva/page.tsx" "app/(app)/almacen/page.tsx" app/api/almacen/cosecha/route.ts
git commit -m "feat: aviso de carencia al registrar cosecha y push al jefe"
```

---

### Task 6: Jefe — snapshot + PanelLote + wizard de asignación

**Files:**

- Modify: `lib/jefe/snapshot.ts` (agregar el campo al snapshot)
- Modify: `components/mapa3d/CentroControl.tsx` (memo + prop)
- Modify: `components/mapa3d/PanelLote.tsx` (línea de carencia)
- Modify: `app/(app)/jefe/asignaciones/nueva/page.tsx` (pasar carencias)
- Modify: `app/(app)/jefe/asignaciones/nueva/WizardNuevaAsignacion.tsx` (advertencia en paso 4)

- [ ] **Step 1: Snapshot**

En `lib/jefe/snapshot.ts`: importar `carenciasActivas` de `@/lib/jefe/carencias` y, en el objeto de retorno de `construirSnapshotJefaUncached` (junto a `prediccion_por_lote: await obtenerPredicciones(),`), agregar:

```ts
carencias_por_lote: await carenciasActivas(),
```

- [ ] **Step 2: CentroControl**

En `components/mapa3d/CentroControl.tsx`, junto al memo `prediccionPorLote`:

```ts
const carenciaPorLote = useMemo(() => {
  const m = new Map<string, NonNullable<SnapshotJefe['carencias_por_lote']>[number]>();
  for (const c of snapshot.carencias_por_lote ?? []) m.set(c.lote_id, c);
  return m;
}, [snapshot.carencias_por_lote]);
```

Y en el `<PanelLote ...>`, junto a `prediccion={...}`:

```tsx
carencia={carenciaPorLote.get(loteSel.id) ?? null}
```

- [ ] **Step 3: PanelLote**

En `components/mapa3d/PanelLote.tsx`: prop nueva en la firma (junto a `prediccion`):

```ts
carencia?: { insumo: string; hasta: string } | null;
```

Import: `import { fmtCarenciaHasta } from '@/lib/carencia';` (AlertTriangle ya está importado).

Después del bloque `{prediccion ? (...) : null}`:

```tsx
{
  carencia ? (
    <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-zelanda-ocre-700">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      En carencia hasta el {fmtCarenciaHasta(carencia.hasta)} · {carencia.insumo}
    </p>
  ) : null;
}
```

- [ ] **Step 4: Wizard — página**

En `app/(app)/jefe/asignaciones/nueva/page.tsx`: importar `carenciasActivas`, sumar `carenciasActivas()` al `Promise.all` inicial (último elemento, destructurado como `carencias`), y pasar `carencias={carencias}` al `<WizardNuevaAsignacion ... />`.

- [ ] **Step 5: Wizard — advertencia en el paso de confirmación**

En `WizardNuevaAsignacion.tsx`:

1. Prop nueva: `carencias: { lote_id: string; insumo: string; hasta: string }[];` (agregar a la firma y al destructuring).
2. Imports: `AlertTriangle` (sumar al import de lucide-react) y `import { fmtCarenciaHasta } from '@/lib/carencia';`
3. Derivado (después de donde se calculan `tipoSel`/`destinoSeleccionado` — leer el componente; `tipoSel` existe porque se pasa a `<Paso4 tipo={tipoSel} ...>`):

```ts
// Advertencia de carencia: solo tareas de cosecha en lotes (heurística por
// nombre: los tipos de tarea son configurables). Apiarios no tienen lote.
const advertenciaCarencia =
  destino === 'lote' && loteId && tipoSel && /cosech/i.test(tipoSel.nombre)
    ? carencias.find((c) => c.lote_id === loteId) ?? null
    : null;
```

4. Render — dentro del contenedor de pasos, inmediatamente después del bloque `{paso === 4 ? (<Paso4 ... />) : null}` y antes del bloque de error:

```tsx
{
  paso === 4 && advertenciaCarencia ? (
    <p className="mt-4 flex items-start gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-ocre-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Este lote está en carencia hasta el {fmtCarenciaHasta(advertenciaCarencia.hasta)} por{' '}
        {advertenciaCarencia.insumo} — la fruta podría no ser apta si se cosecha antes.
      </span>
    </p>
  ) : null;
}
```

(No bloquea: el botón "Crear asignación" sigue habilitado.)

- [ ] **Step 6: Verificar** — `npm run lint`, `npm run check:types`, `npm run test` limpios.

- [ ] **Step 7: Commit**

```bash
git add lib/jefe/snapshot.ts components/mapa3d/CentroControl.tsx components/mapa3d/PanelLote.tsx "app/(app)/jefe/asignaciones/nueva/page.tsx" "app/(app)/jefe/asignaciones/nueva/WizardNuevaAsignacion.tsx"
git commit -m "feat: carencia visible en el panel del lote y el wizard de asignacion"
```

---

### Task 7: CI, documentación y cierre

**Files:**

- Modify: `CLAUDE.md` (§6 migraciones + backlog Fase 8)

- [ ] **Step 1: CI completo**

Run: `npm run ci` → lint limpio, **100 tests** (94 + 6 nuevos), build verde.

- [ ] **Step 2: CLAUDE.md**

En §6: sumar `migracion-ficha-tecnica.sql` a la lista. En el backlog de Fase 8: quitar la v2 de trazabilidad (queda hecha) — el backlog queda solo con "e2e de flujos críticos". Agregar a "Ya implementados de esa revisión": "ficha técnica del químico + alerta de carencia (spec `2026-06-12-ficha-tecnica-carencia-design.md`)".

- [ ] **Step 3: Commit + verificación manual**

```bash
git add CLAUDE.md
git commit -m "docs: ficha tecnica y carencia en CLAUDE.md"
```

Prueba manual (requiere la migración de Task 1 aplicada y datos: un insumo con carencia configurada + un despacho cerrado con ese insumo en un lote):

1. Bodega: editar un insumo químico → llenar carencia (ej. 14 días) → guardar → el detalle muestra la ficha.
2. Cerrar un despacho con ese insumo aplicado a un lote.
3. Almacén: nueva cosecha → elegir ese lote → banner ámbar. Registrar → el jefe recibe el push.
4. Jefe: tocar el lote en el mapa → "En carencia hasta…". Asignar tarea "Cosecha" en ese lote → advertencia en el paso de confirmación.

El merge a main + push requiere confirmación explícita de Samuel (igual que la v1).
