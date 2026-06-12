# Registro de aplicaciones de insumos por lote: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazabilidad insumo → lote: bodega confirma el lote al cerrar el despacho, el jefe consulta el registro auditable con CSV en `/jefe/aplicaciones` y el costo de insumos por lote en reportes avanzados.

**Architecture:** Spec en `docs/superpowers/specs/2026-06-12-aplicaciones-insumos-lote-design.md`. Enfoque A: dos columnas nuevas (`despachos.lote_id`, `despacho_items.costo_unitario_snapshot`) con backfill; el registro es una consulta derivada, sin tabla nueva. Lógica pura testeada en `lib/aplicaciones.ts`; queries server en `lib/jefe/aplicaciones.ts`; CSV con el `DescargarCSVButton` existente.

**Tech Stack:** Prisma + PostgreSQL (Supabase), Next.js App Router, vitest, patrón offline existente (`lib/offline`).

---

### Task 1: Migración SQL + schema Prisma

**Files:**

- Create: `supabase/migracion-aplicaciones.sql`
- Modify: `prisma/schema.prisma` (modelos `despachos`, `despacho_items`, `lotes`)

- [ ] **Step 1: Escribir la migración**

`supabase/migracion-aplicaciones.sql`:

```sql
-- ============================================================
-- Trazabilidad de aplicaciones: lote del despacho + costo congelado
-- al cierre. Ver docs/superpowers/specs/2026-06-12-aplicaciones-insumos-lote-design.md
-- ============================================================

ALTER TABLE despachos
  ADD COLUMN IF NOT EXISTS lote_id BIGINT REFERENCES lotes(id);

ALTER TABLE despacho_items
  ADD COLUMN IF NOT EXISTS costo_unitario_snapshot NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_despachos_lote ON despachos(lote_id);

-- Backfill: despachos históricos vinculados a una asignación de lote
-- heredan su lote. Recupera trazabilidad pasada sin trabajo manual.
UPDATE despachos d
SET lote_id = a.lote_id
FROM asignaciones a
WHERE d.asignacion_id = a.id
  AND d.lote_id IS NULL
  AND a.lote_id IS NOT NULL;
```

- [ ] **Step 2: Espejar en `prisma/schema.prisma`**

En `model despachos` (línea ~629), agregar campo, relación e índice:

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
  lote_id                   BigInt?
  id_local                  String?          @unique @db.Uuid
  despacho_items            despacho_items[]
  asignacion                asignaciones?    @relation(fields: [asignacion_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lotes                     lotes?           @relation(fields: [lote_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuarios                  usuarios         @relation(fields: [despachado_por_usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  persona                   personas         @relation(fields: [persona_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([persona_id, estado], map: "idx_despachos_persona_estado")
  @@index([asignacion_id], map: "idx_despachos_asignacion")
  @@index([lote_id], map: "idx_despachos_lote")
  @@schema("public")
}
```

En `model despacho_items` (línea ~610), después de `condicion_devolucion`:

```prisma
  costo_unitario_snapshot Decimal? @db.Decimal(12, 2)
```

En `model lotes`, agregar la back-relation (junto a las otras listas tipo `asignaciones asignaciones[]`):

```prisma
  despachos despachos[]
```

- [ ] **Step 3: Regenerar el cliente y verificar tipos**

Run: `npx prisma generate` → Expected: `Generated Prisma Client`
Run: `npm run check:types` → Expected: sin errores

- [ ] **Step 4: CHECKPOINT — Samuel ejecuta la migración**

Pedir a Samuel que corra `supabase/migracion-aplicaciones.sql` en Supabase → SQL Editor (como las migraciones anteriores). **No seguir a tareas que dependan de la BD en runtime hasta confirmar.** (Las tareas 2–7 compilan y testean sin BD, así que se puede avanzar en paralelo si Samuel demora.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migracion-aplicaciones.sql prisma/schema.prisma
git commit -m "feat: columnas de trazabilidad (lote del despacho y costo congelado)"
```

---

### Task 2: Lógica pura `lib/aplicaciones.ts` (TDD)

**Files:**

- Create: `lib/aplicaciones.ts`
- Test: `lib/aplicaciones.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`lib/aplicaciones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { costoAplicacion, agruparCostoPorLote } from './aplicaciones';

describe('costoAplicacion', () => {
  it('usa el costo congelado al cierre si existe', () => {
    expect(costoAplicacion(2, 5000, 9000)).toBe(10000);
  });
  it('cae al costo actual si no hay snapshot (cierres pre-migración)', () => {
    expect(costoAplicacion(2, null, 9000)).toBe(18000);
  });
  it('sin ningún costo conocido vale 0', () => {
    expect(costoAplicacion(2, null, null)).toBe(0);
  });
});

describe('agruparCostoPorLote', () => {
  it('suma por lote y ordena de mayor a menor', () => {
    const r = agruparCostoPorLote([
      { lote_id: '1', lote_nombre: 'Salento', costo: 10000 },
      { lote_id: '2', lote_nombre: 'Pijao', costo: 50000 },
      { lote_id: '1', lote_nombre: 'Salento', costo: 5000 },
    ]);
    expect(r).toEqual([
      { lote_id: '2', nombre: 'Pijao', costo: 50000 },
      { lote_id: '1', nombre: 'Salento', costo: 15000 },
    ]);
  });
  it('ignora aplicaciones sin lote', () => {
    expect(agruparCostoPorLote([{ lote_id: null, lote_nombre: null, costo: 9999 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/aplicaciones.test.ts`
Expected: FAIL — `Cannot find module './aplicaciones'`

- [ ] **Step 3: Implementación mínima**

`lib/aplicaciones.ts`:

```ts
// Cálculos puros del registro de aplicaciones de insumos por lote.

/** Costo de una aplicación: costo congelado al cierre del despacho; si no
 *  existe (cierres anteriores a la migración), el costo actual del catálogo. */
export function costoAplicacion(
  cantidad: number,
  costoSnapshot: number | null,
  costoActual: number | null
): number {
  return cantidad * (costoSnapshot ?? costoActual ?? 0);
}

export type FilaCostoLote = {
  lote_id: string | null;
  lote_nombre: string | null;
  costo: number;
};

/** Agrega el costo de insumos por lote, de mayor a menor. Sin lote no entra. */
export function agruparCostoPorLote(
  filas: FilaCostoLote[]
): { lote_id: string; nombre: string; costo: number }[] {
  const m = new Map<string, { lote_id: string; nombre: string; costo: number }>();
  for (const f of filas) {
    if (f.lote_id === null) continue;
    const prev = m.get(f.lote_id) ?? {
      lote_id: f.lote_id,
      nombre: f.lote_nombre ?? `Lote ${f.lote_id}`,
      costo: 0,
    };
    prev.costo += f.costo;
    m.set(f.lote_id, prev);
  }
  return [...m.values()].sort((a, b) => b.costo - a.costo);
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run lib/aplicaciones.test.ts` → Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add lib/aplicaciones.ts lib/aplicaciones.test.ts
git commit -m "feat: calculo puro de costo de aplicaciones por lote"
```

---

### Task 3: API de cierre acepta `lote_id` y congela el costo

**Files:**

- Modify: `app/api/bodega/despacho/cerrar/route.ts`

- [ ] **Step 1: Extender el `Body` y validar**

En el type `Body` (línea ~16), agregar `lote_id`:

```ts
type Body = {
  id_local: string;
  despacho_id: string;
  items: ItemBody[];
  lote_id?: string | null;
};
```

Después de la validación de `despacho_id` (línea ~47), validar el lote:

```ts
const loteId =
  body.lote_id != null && /^\d+$/.test(String(body.lote_id)) ? BigInt(body.lote_id) : null;
```

- [ ] **Step 2: Congelar costos de insumos**

Justo después de `const disponiblesAntes = await snapshotDisponiblesAntes(insumoIdsPush);` (línea ~156):

```ts
// Congelar el costo unitario del catálogo al momento del cierre: el costo
// histórico por lote no se distorsiona cuando cambie el precio del insumo.
const costosActuales = await prisma.insumos.findMany({
  where: { id: { in: insumoIdsPush } },
  select: { id: true, costo_unitario: true },
});
const mapaCostos = new Map(costosActuales.map((c) => [c.id.toString(), c.costo_unitario]));
```

- [ ] **Step 3: Persistir en la transacción**

En el `update` del item INSUMO (línea ~171), agregar el snapshot:

```ts
await tx.despacho_items.update({
  where: { id: a.itemId },
  data: {
    cantidad_consumida: a.consumido!,
    costo_unitario_snapshot:
      a.insumoId !== null ? mapaCostos.get(a.insumoId.toString()) ?? null : null,
  },
});
```

En el `update` final del despacho (línea ~208), agregar `lote_id`:

```ts
await tx.despachos.update({
  where: { id: despachoId },
  data: { estado: 'CERRADO', fecha_devolucion: new Date(), lote_id: loteId },
});
```

(Si el `lote_id` no existe en la BD, la FK hace fallar la transacción y `sanitizarError` responde 500 — aceptable: solo puede pasar con un payload manipulado.)

- [ ] **Step 4: Verificar**

Run: `npm run lint` y `npm run check:types` → Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add app/api/bodega/despacho/cerrar/route.ts
git commit -m "feat: el cierre de despacho guarda lote y congela costos"
```

---

### Task 4: UI de cierre (bodega) con selector de lote + cola offline

**Files:**

- Modify: `app/(app)/bodega/despachos/[id]/page.tsx`
- Modify: `app/(app)/bodega/despachos/[id]/_formulario.tsx`
- Modify: `lib/offline/tipos.ts` (~línea 238, `ItemColaDespachoCerrar`)
- Modify: `lib/offline/sync.ts` (~línea 82, `payloadDespachoCerrar`)

- [ ] **Step 1: Tipo de cola y payload de sync**

En `lib/offline/tipos.ts`, `ItemColaDespachoCerrar` suma el campo (opcional: items viejos encolados sin él siguen siendo válidos):

```ts
export type ItemColaDespachoCerrar = {
  id_local: string;
  despacho_id: string;
  lote_id?: string | null;
  items: Array<{
    despacho_item_id: string;
    tipo: 'HERRAMIENTA' | 'INSUMO';
    devuelto?: boolean;
    consumido?: number;
    condicion_devolucion?: string | null;
  }>;
  estado: EstadoCola;
  intentos: number;
  ultimo_error: string | null;
  creado_en: number;
};
```

En `lib/offline/sync.ts`:

```ts
function payloadDespachoCerrar(i: ItemColaDespachoCerrar) {
  return {
    id_local: i.id_local,
    despacho_id: i.despacho_id,
    lote_id: i.lote_id ?? null,
    items: i.items,
  };
}
```

- [ ] **Step 2: La página pasa lotes y preselección**

En `app/(app)/bodega/despachos/[id]/page.tsx`:

1. En el `include` de la query del despacho, el `asignacion` debe traer también el id del lote y el despacho su lote propio:

```ts
asignacion: {
  select: {
    tipos_tarea: { select: { nombre: true } },
    lotes: { select: { id: true, nombre: true } },
    apiarios: { select: { nombre: true } },
  },
},
lotes: { select: { nombre: true } },
```

2. Después de la query del despacho, traer el catálogo de lotes (solo si está ABIERTO y hay insumos):

```ts
const hayInsumos = despacho.despacho_items.some((it) => it.tipo_item === 'INSUMO');
const lotes =
  despacho.estado === 'ABIERTO' && hayInsumos
    ? await prisma.lotes.findMany({
        where: { deleted_at: null },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      })
    : [];
```

3. Pasar props nuevas al formulario:

```tsx
<FormularioCierreDespacho
  despachoId={despacho.id.toString()}
  lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))}
  lotePreseleccionado={despacho.asignacion?.lotes?.id?.toString() ?? null}
  items={...} // sin cambios
/>
```

4. En la vista de despacho CERRADO, mostrar el lote si existe — después del `<ul>` de items (línea ~133), antes de cerrar la `<section>`:

```tsx
{
  despacho.lotes ? (
    <p className="mt-2 border-t border-zelanda-beige-200 pt-2 text-xs text-zelanda-verde-700">
      Insumos aplicados en el lote <span className="font-medium">{despacho.lotes.nombre}</span>
    </p>
  ) : null;
}
```

- [ ] **Step 3: Selector en el formulario**

En `_formulario.tsx`:

1. Props nuevas:

```ts
export function FormularioCierreDespacho({
  despachoId,
  items,
  lotes,
  lotePreseleccionado,
}: {
  despachoId: string;
  items: ItemRow[];
  lotes: { id: string; nombre: string }[];
  lotePreseleccionado: string | null;
}) {
```

2. Estado (junto a `observaciones`): `const [loteId, setLoteId] = useState<string>(lotePreseleccionado ?? '');`

3. UI — dentro de la sección de insumos existente (`{insumos.length > 0 ? (...)}`), después del `</div>` que lista las `FilaConsumo`:

```tsx
<div className="mt-3">
  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
    ¿En qué lote se aplicó?
  </label>
  <select
    value={loteId}
    onChange={(e) => setLoteId(e.target.value)}
    className="block w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2.5 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
  >
    <option value="">Sin lote (bodega / apiario / general)</option>
    {lotes.map((l) => (
      <option key={l.id} value={l.id}>
        {l.nombre}
      </option>
    ))}
  </select>
  <p className="mt-1.5 text-[10.5px] text-zelanda-verde-700">
    Queda en el registro de aplicaciones del lote (trazabilidad).
  </p>
</div>
```

4. En `onSubmit`, el envío suma el lote (solo aplica si hay insumos):

```ts
const r = await enviarDespachoCerrar({
  despacho_id: despachoId,
  lote_id: insumos.length > 0 && loteId !== '' ? loteId : null,
  items: payload,
});
```

Nota: `const insumos = items.filter(...)` ya existe más abajo en el componente — moverla arriba de `onSubmit` (junto a `herramientas`) para poder usarla ahí.

- [ ] **Step 4: Verificar**

Run: `npm run lint` y `npm run check:types` → Expected: sin errores
Run: `npm run test` → Expected: todos pasan (la cola tolera items viejos sin `lote_id` por ser opcional)

- [ ] **Step 5: Commit**

```bash
git add app/(app)/bodega/despachos/[id]/page.tsx "app/(app)/bodega/despachos/[id]/_formulario.tsx" lib/offline/tipos.ts lib/offline/sync.ts
git commit -m "feat: bodega confirma el lote al cerrar despachos con insumos"
```

---

### Task 5: Query server `lib/jefe/aplicaciones.ts`

**Files:**

- Create: `lib/jefe/aplicaciones.ts`

- [ ] **Step 1: Implementar**

```ts
import 'server-only';
import { prisma } from '@/lib/prisma';
import { costoAplicacion } from '@/lib/aplicaciones';

export type Aplicacion = {
  id: string; // despacho_item_id
  despacho_id: string;
  fecha: Date; // fecha del despacho = día del trabajo
  insumo: string;
  unidad: string;
  cantidad: number;
  lote_id: string | null;
  lote: string | null;
  persona: string;
  tarea: string | null;
  costo: number;
};

/** Registro de aplicaciones: items insumo consumidos de despachos cerrados. */
export async function obtenerAplicaciones(desde: Date, hasta: Date): Promise<Aplicacion[]> {
  const items = await prisma.despacho_items.findMany({
    where: {
      tipo_item: 'INSUMO',
      cantidad_consumida: { gt: 0 },
      despachos: { estado: 'CERRADO', fecha: { gte: desde, lte: hasta } },
    },
    include: {
      insumos: { select: { nombre: true, unidad: true, costo_unitario: true } },
      despachos: {
        select: {
          id: true,
          fecha: true,
          lote_id: true,
          lotes: { select: { nombre: true } },
          persona: { select: { nombre_completo: true } },
          asignacion: { select: { tipos_tarea: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { despachos: { fecha: 'desc' } },
  });

  return items.map((it) => ({
    id: it.id.toString(),
    despacho_id: it.despachos.id.toString(),
    fecha: it.despachos.fecha,
    insumo: it.insumos?.nombre ?? '?',
    unidad: it.insumos?.unidad ?? '',
    cantidad: Number(it.cantidad_consumida ?? 0),
    lote_id: it.despachos.lote_id?.toString() ?? null,
    lote: it.despachos.lotes?.nombre ?? null,
    persona: it.despachos.persona.nombre_completo,
    tarea: it.despachos.asignacion?.tipos_tarea?.nombre ?? null,
    costo: costoAplicacion(
      Number(it.cantidad_consumida ?? 0),
      it.costo_unitario_snapshot === null ? null : Number(it.costo_unitario_snapshot),
      it.insumos?.costo_unitario == null ? null : Number(it.insumos.costo_unitario)
    ),
  }));
}
```

- [ ] **Step 2: Verificar**

Run: `npm run check:types` → Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add lib/jefe/aplicaciones.ts
git commit -m "feat: consulta del registro de aplicaciones"
```

---

### Task 6: Página `/jefe/aplicaciones` + atajo

**Files:**

- Create: `app/(app)/jefe/aplicaciones/page.tsx`
- Create: `app/(app)/jefe/aplicaciones/FiltroLote.tsx`
- Modify: `components/mapa3d/PanelCentral.tsx` (sección "Más", junto a Compras)

- [ ] **Step 1: Filtro de lote (client, navega con searchParams)**

`app/(app)/jefe/aplicaciones/FiltroLote.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function FiltroLote({ lotes }: { lotes: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const actual = sp.get('lote') ?? '';

  function cambiar(valor: string) {
    const params = new URLSearchParams(sp.toString());
    if (valor === '') params.delete('lote');
    else params.set('lote', valor);
    router.push(`/jefe/aplicaciones?${params.toString()}`);
  }

  return (
    <select
      value={actual}
      onChange={(e) => cambiar(e.target.value)}
      aria-label="Filtrar por lote"
      className="rounded-[10px] border border-zelanda-beige-300 bg-white px-2.5 py-1.5 text-[13px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
    >
      <option value="">Todos los lotes</option>
      {lotes.map((l) => (
        <option key={l.id} value={l.id}>
          {l.nombre}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: La página**

`app/(app)/jefe/aplicaciones/page.tsx` (mismo patrón de navegación mensual de `/jefe/ventas`):

```tsx
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { DescargarCSVButton } from '@/components/jefe/DescargarCSVButton';
import { mesBogota, periodoMesBogota } from '@/lib/fecha';
import { obtenerAplicaciones } from '@/lib/jefe/aplicaciones';
import { FiltroLote } from './FiltroLote';

export const metadata = { title: 'Aplicaciones' };

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Bogota',
  });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return mesBogota();
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaAplicaciones({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lote?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  const { desde, hasta } = periodoMesBogota(anio, mes);
  const loteFiltro = sp.lote && /^\d+$/.test(sp.lote) ? sp.lote : null;

  const [todas, lotes] = await Promise.all([
    obtenerAplicaciones(desde, hasta),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);
  const aplicaciones = loteFiltro ? todas.filter((a) => a.lote_id === loteFiltro) : todas;
  const costoTotal = aplicaciones.reduce((acc, a) => acc + a.costo, 0);

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);
  const claveMes = aClaveMes(anio, mes);
  const conservarLote = loteFiltro ? `&lote=${loteFiltro}` : '';

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <Eyebrow>Trazabilidad · Insumos</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Registro de aplicaciones
        </h1>
        <p className="mt-0.5 text-[12.5px] text-zelanda-verde-700">
          Qué producto se aplicó en qué lote, según los despachos cerrados de bodega.
        </p>
      </header>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={`/jefe/aplicaciones?mes=${mesAnterior}${conservarLote}`}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zelanda-beige-300 bg-white text-zelanda-verde-800 hover:bg-zelanda-beige-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[130px] text-center font-serif text-[15px] text-zelanda-verde-900">
            {MESES[mes]} {anio}
          </span>
          <Link
            href={`/jefe/aplicaciones?mes=${mesSiguiente}${conservarLote}`}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zelanda-beige-300 bg-white text-zelanda-verde-800 hover:bg-zelanda-beige-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <FiltroLote lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))} />
      </div>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              {aplicaciones.length} {aplicaciones.length === 1 ? 'aplicación' : 'aplicaciones'} ·{' '}
              {fmtMonto(costoTotal)}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Fecha = día del despacho (el día del trabajo)
            </p>
          </div>
          <DescargarCSVButton
            filename={`aplicaciones-${claveMes}.csv`}
            headers={[
              'Fecha',
              'Producto',
              'Cantidad',
              'Unidad',
              'Lote',
              'Aplicó',
              'Tarea',
              'Costo',
            ]}
            rows={aplicaciones.map((a) => [
              a.fecha.toISOString().slice(0, 10),
              a.insumo,
              a.cantidad.toFixed(3),
              a.unidad,
              a.lote ?? 'Sin lote',
              a.persona,
              a.tarea ?? '',
              a.costo.toFixed(0),
            ])}
          />
        </div>

        {aplicaciones.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-zelanda-verde-700/70">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Sin aplicaciones registradas este mes.
          </p>
        ) : (
          <ul className="mt-3 list-none divide-y divide-zelanda-beige-200 p-0">
            {aplicaciones.map((a) => (
              <li key={a.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="m-0 text-sm text-zelanda-verde-900">
                    <span className="font-medium">{a.insumo}</span> · {a.cantidad} {a.unidad}
                  </p>
                  <span className="shrink-0 text-sm text-zelanda-verde-800">
                    {fmtMonto(a.costo)}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                  {fmtFecha(a.fecha)} · {a.lote ?? 'Sin lote'} · {a.persona}
                  {a.tarea ? ` · ${a.tarea.toLowerCase()}` : ''}
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

- [ ] **Step 3: Atajo en PanelCentral**

En `components/mapa3d/PanelCentral.tsx`: importar `FlaskConical` de lucide-react (sumarlo al import existente) y agregar en la sección "Más", después del Atajo de Compras (línea ~249):

```tsx
<Atajo
  href="/jefe/aplicaciones"
  icono={FlaskConical}
  titulo="Aplicaciones"
  sub="Insumos por lote"
/>
```

- [ ] **Step 4: Verificar**

Run: `npm run lint` y `npm run check:types` → Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/jefe/aplicaciones" components/mapa3d/PanelCentral.tsx
git commit -m "feat: registro de aplicaciones con CSV en /jefe/aplicaciones"
```

---

### Task 7: Costo de insumos por lote en reportes avanzados

**Files:**

- Modify: `app/(app)/jefe/reportes/avanzados/page.tsx`

- [ ] **Step 1: Datos**

Importar arriba:

```ts
import { obtenerAplicaciones } from '@/lib/jefe/aplicaciones';
import { agruparCostoPorLote } from '@/lib/aplicaciones';
```

Después del `Promise.all` existente (las queries del mes ya calculadas), agregar:

```ts
const aplicacionesMes = await obtenerAplicaciones(desdeTZ, hastaTZ);
const costoInsumosPorLote = agruparCostoPorLote(
  aplicacionesMes.map((a) => ({ lote_id: a.lote_id, lote_nombre: a.lote, costo: a.costo }))
);
const costoInsumosTotal = costoInsumosPorLote.reduce((acc, l) => acc + l.costo, 0);
```

- [ ] **Step 2: Sección**

Insertar inmediatamente después del cierre de la sección "Resumen financiero" (`</section>` de la línea ~314), porque comparte el mes seleccionado:

```tsx
{
  /* Costo de insumos por lote (mes seleccionado) */
}
<section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
  <h2 className="font-serif text-base text-zelanda-verde-900">Costo de insumos por lote</h2>
  <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
    {MESES[mes]} {anio} · según despachos cerrados ·{' '}
    <Link href="/jefe/aplicaciones" className="underline">
      ver registro completo
    </Link>
  </p>
  {costoInsumosPorLote.length === 0 ? (
    <p className="mt-3 text-sm text-zelanda-verde-700/70">Sin aplicaciones con lote este mes.</p>
  ) : (
    <>
      <ul className="mt-3 list-none space-y-2 p-0">
        {costoInsumosPorLote.map((l) => (
          <li key={l.lote_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zelanda-verde-900">{l.nombre}</span>
            <span className="text-zelanda-verde-700">{fmtMonto(l.costo)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-zelanda-beige-200 pt-2 text-right text-sm font-medium text-zelanda-verde-900">
        Total: {fmtMonto(costoInsumosTotal)}
      </p>
    </>
  )}
</section>;
```

- [ ] **Step 3: Verificar**

Run: `npm run lint` y `npm run check:types` → Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/jefe/reportes/avanzados/page.tsx"
git commit -m "feat: costo de insumos por lote en reportes avanzados"
```

---

### Task 8: CI, documentación y cierre

**Files:**

- Modify: `CLAUDE.md` (§6 esquema y backlog de Fase 8)

- [ ] **Step 1: CI completo**

Run: `npm run ci`
Expected: lint sin warnings, **94 tests** (89 + 5 nuevos), build verde.

- [ ] **Step 2: Actualizar CLAUDE.md**

En §6, sumar `migracion-aplicaciones.sql` a la lista de migraciones. En el backlog de Fase 8, quitar "trazabilidad de aplicaciones químicas insumo→lote" (queda hecho) y dejar anotado: "v2 de trazabilidad: ficha técnica del químico (ingrediente activo, registro ICA, carencia/reingreso) y alerta de carencia al registrar cosecha".

- [ ] **Step 3: Commit + push + verificación manual**

```bash
git add CLAUDE.md
git commit -m "docs: registro de aplicaciones en CLAUDE.md"
git push
```

Prueba manual (requiere la migración de Task 1 aplicada):

1. Como BODEGA: crear despacho con un insumo vinculado a una asignación → cerrarlo → el selector de lote viene preseleccionado → confirmar.
2. Como JEFE: `/jefe/aplicaciones` muestra la fila con producto, lote, persona y costo; el CSV descarga.
3. Reportes avanzados muestran el costo del lote en el mes actual.
4. Offline (modo avión): cerrar un despacho → aparece en `/bodega/pendientes` → al volver la señal sincroniza con el lote.
