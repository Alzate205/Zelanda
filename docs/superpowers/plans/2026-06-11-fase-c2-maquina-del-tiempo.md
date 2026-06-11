# Fase C2 — Máquina del Tiempo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un modo "Historia" en el centro de control con un slider mensual: el mapa pinta los lotes según los kg cosechados del mes elegido y muestra los contadores de ese mes (kg totales, tareas completadas, novedades) — la evolución de la finca contada sobre el mapa (spec C2).

**Architecture:** `lib/historia-meses.ts` (puro, testeado) genera la lista de meses entre dos fechas. `lib/jefe/historia.ts` (server) calcula los datos de un mes con `unstable_cache` (meses pasados cachean 24 h; el mes en curso 5 min). `/api/jefe/historia` lo expone: sin parámetro devuelve el rango disponible, con `?mes=YYYY-MM` los datos. En el cliente, un cuarto chip "Historia" activa el modo: `CentroControl` trae el mes elegido (con cache en memoria), recolorea los lotes con `rampaCosecha` y muestra la tarjeta `HistoriaSlider` en lugar del dock. Sin dependencias nuevas, sin BD.

**Tech Stack:** Next.js API route, unstable_cache, React.

---

## Mapa de archivos

| Archivo                                | Acción | Responsabilidad                                                 |
| -------------------------------------- | ------ | --------------------------------------------------------------- |
| `lib/historia-meses.ts`                | Create | `listaMeses('2024-03','2024-06') → ['2024-03',…]` (puro)        |
| `lib/historia-meses.test.ts`           | Create | Tests                                                           |
| `lib/jefe/historia.ts`                 | Create | Datos de un mes (cosecha por lote, tareas, novedades) cacheados |
| `app/api/jefe/historia/route.ts`       | Create | GET rango / GET ?mes=                                           |
| `components/mapa3d/HistoriaSlider.tsx` | Create | Tarjeta con slider, mes, contadores                             |
| `components/mapa3d/Mapa3D.tsx`         | Modify | `ModoMapa` + `'historia'` (pinta como cosecha)                  |
| `components/mapa3d/ChipsModos.tsx`     | Modify | Cuarto chip                                                     |
| `components/mapa3d/CentroControl.tsx`  | Modify | Estado historia, fetch por mes, recoloreo                       |

---

### Task 1: listaMeses (TDD)

**Files:**

- Create: `lib/historia-meses.ts`
- Test: `lib/historia-meses.test.ts`

- [ ] **Step 1: Test que falla** — crear `lib/historia-meses.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listaMeses } from './historia-meses';

describe('listaMeses', () => {
  it('genera los meses entre desde y hasta inclusive', () => {
    expect(listaMeses('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('mismo mes devuelve solo ese', () => {
    expect(listaMeses('2026-06', '2026-06')).toEqual(['2026-06']);
  });
  it('rango invertido devuelve vacío', () => {
    expect(listaMeses('2026-06', '2026-01')).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/historia-meses.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar** `lib/historia-meses.ts`:

```ts
/** Lista de meses 'YYYY-MM' entre desde y hasta, ambos inclusive. */
export function listaMeses(desde: string, hasta: string): string[] {
  const [aD, mD] = desde.split('-').map(Number);
  const [aH, mH] = hasta.split('-').map(Number);
  const meses: string[] = [];
  let anio = aD;
  let mes = mD;
  while (anio < aH || (anio === aH && mes <= mH)) {
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }
  return meses;
}
```

- [ ] **Step 4:** `npx vitest run lib/historia-meses.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/historia-meses.ts lib/historia-meses.test.ts
git commit -m "feat: listaMeses para la máquina del tiempo"
```

---

### Task 2: Datos del mes en el servidor

**Files:**

- Create: `lib/jefe/historia.ts`
- Create: `app/api/jefe/historia/route.ts`

- [ ] **Step 1: Crear `lib/jefe/historia.ts`**

```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type HistoriaMes = {
  mes: string; // 'YYYY-MM'
  cosecha_por_lote: { lote_id: string; kg: number }[];
  total_kg: number;
  tareas_completadas: number;
  novedades: number;
};

export type RangoHistoria = { desde: string; hasta: string };

function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const obtenerHistoriaMesUncached = async (mes: string): Promise<HistoriaMes> => {
  const [anio, mesNum] = mes.split('-').map(Number);
  const inicio = new Date(anio, mesNum - 1, 1);
  const fin = new Date(anio, mesNum, 1);

  const [cosechaRaw, totalRaw, tareas, novedades] = await Promise.all([
    prisma.cosechas.groupBy({
      by: ['lote_id'],
      where: { fecha: { gte: inicio, lt: fin } },
      _sum: { peso_kg: true },
    }),
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicio, lt: fin } },
      _sum: { peso_kg: true },
    }),
    prisma.asignaciones.count({
      where: { estado: 'COMPLETADA', fecha_completada: { gte: inicio, lt: fin } },
    }),
    prisma.novedades.count({
      where: { fecha: { gte: inicio, lt: fin } },
    }),
  ]);

  return {
    mes,
    cosecha_por_lote: cosechaRaw.map((c) => ({
      lote_id: String(c.lote_id),
      kg: Number(c._sum.peso_kg ?? 0),
    })),
    total_kg: Number(totalRaw._sum.peso_kg ?? 0),
    tareas_completadas: tareas,
    novedades,
  };
};

// Meses cerrados no cambian: cache de 24 h. El mes en curso, 5 min.
const historiaMesPasado = unstable_cache(obtenerHistoriaMesUncached, ['historia-mes'], {
  revalidate: 86400,
});
const historiaMesActual = unstable_cache(obtenerHistoriaMesUncached, ['historia-mes-actual'], {
  revalidate: 300,
});

export async function obtenerHistoriaMes(mes: string): Promise<HistoriaMes> {
  const esActual = mes === claveMes(new Date());
  return esActual ? historiaMesActual(mes) : historiaMesPasado(mes);
}

const obtenerRangoUncached = async (): Promise<RangoHistoria> => {
  const [primeraCosecha, primeraNovedad] = await Promise.all([
    prisma.cosechas.aggregate({ _min: { fecha: true } }),
    prisma.novedades.aggregate({ _min: { fecha: true } }),
  ]);
  const fechas = [primeraCosecha._min.fecha, primeraNovedad._min.fecha].filter(
    (f): f is Date => f !== null
  );
  const hoy = new Date();
  const desde = fechas.length > 0 ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : hoy;
  return { desde: claveMes(desde), hasta: claveMes(hoy) };
};

export const obtenerRangoHistoria = unstable_cache(obtenerRangoUncached, ['historia-rango'], {
  revalidate: 3600,
});
```

- [ ] **Step 2: Crear `app/api/jefe/historia/route.ts`** (mismo patrón de auth que `/api/jefe/snapshot`):

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { obtenerHistoriaMes, obtenerRangoHistoria } from '@/lib/jefe/historia';

export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== 'JEFE') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const mes = request.nextUrl.searchParams.get('mes');
  if (mes === null) {
    const rango = await obtenerRangoHistoria();
    return NextResponse.json({ ok: true, data: rango });
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ ok: false, error: 'Mes inválido (YYYY-MM)' }, { status: 400 });
  }
  const datos = await obtenerHistoriaMes(mes);
  return NextResponse.json({ ok: true, data: datos });
}
```

- [ ] **Step 3:** `npm run check:types && npm run lint && npm run build` → verde.

- [ ] **Step 4: Commit**

```bash
git add lib/jefe/historia.ts app/api/jefe/historia/route.ts
git commit -m "feat: datos mensuales de historia con cache por mes"
```

---

### Task 3: UI del modo Historia

**Files:**

- Create: `components/mapa3d/HistoriaSlider.tsx`
- Modify: `components/mapa3d/Mapa3D.tsx` (tipo + pintura)
- Modify: `components/mapa3d/ChipsModos.tsx` (cuarto chip)
- Modify: `components/mapa3d/CentroControl.tsx` (estado y fetch)

- [ ] **Step 1: `Mapa3D.tsx`** — ampliar el modo y pintarlo como cosecha:

```ts
export type ModoMapa = 'tareas' | 'cosecha' | 'equipo' | 'historia';
```

En `pinturaFill`, cambiar la primera línea:

```ts
if (modo === 'cosecha' || modo === 'historia') return ['get', 'colorCosecha'] as never;
```

En `crearMarcadores`, el detalle de los marcadores trata historia como cosecha:

```ts
const detalle =
  modo === 'cosecha' || modo === 'historia'
    ? `${Math.round(l.kgMes).toLocaleString('es-CO')} kg`
    : modo === 'equipo'
    ? l.trabajandoHoy > 0
      ? `${l.trabajandoHoy} trabajando`
      : ''
    : '';
```

- [ ] **Step 2: `ChipsModos.tsx`** — agregar el chip:

```ts
const MODOS: Array<{ id: ModoMapa; etiqueta: string }> = [
  { id: 'tareas', etiqueta: 'Tareas' },
  { id: 'cosecha', etiqueta: 'Cosecha' },
  { id: 'equipo', etiqueta: 'Equipo' },
  { id: 'historia', etiqueta: 'Historia' },
];
```

- [ ] **Step 3: Crear `components/mapa3d/HistoriaSlider.tsx`**

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const NOMBRES_MES = [
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

export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return `${NOMBRES_MES[m - 1]} ${anio}`;
}

export function HistoriaSlider({
  meses,
  indice,
  onCambio,
  totalKg,
  tareas,
  novedades,
  cargando,
}: {
  meses: string[];
  indice: number;
  onCambio: (i: number) => void;
  totalKg: number;
  tareas: number;
  novedades: number;
  cargando: boolean;
}) {
  const mes = meses[indice];
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Máquina del tiempo
        </p>
        <p className="m-0 font-serif text-base text-zelanda-verde-900">{etiquetaMes(mes)}</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambio(Math.max(0, indice - 1))}
          disabled={indice === 0}
          aria-label="Mes anterior"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={meses.length - 1}
          value={indice}
          onChange={(e) => onCambio(Number(e.target.value))}
          aria-label="Elegir mes"
          className="h-2 w-full cursor-pointer accent-zelanda-verde-700"
        />
        <button
          type="button"
          onClick={() => onCambio(Math.min(meses.length - 1, indice + 1))}
          disabled={indice === meses.length - 1}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="m-0 mt-2 text-center text-[12.5px] text-zelanda-verde-800">
        {cargando
          ? 'Cargando…'
          : `${Math.round(totalKg).toLocaleString(
              'es-CO'
            )} kg cosechados · ${tareas} tareas · ${novedades} novedades`}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: `CentroControl.tsx`** — estado y fetch del modo historia.

1. Imports: agregar `HistoriaSlider`:

```ts
import { HistoriaSlider } from './HistoriaSlider';
```

2. Estado (junto a `vuelo`):

```ts
type DatosMes = {
  cosecha_por_lote: { lote_id: string; kg: number }[];
  total_kg: number;
  tareas_completadas: number;
  novedades: number;
};
const [mesesHistoria, setMesesHistoria] = useState<string[] | null>(null);
const [indiceMes, setIndiceMes] = useState(0);
const [datosPorMes, setDatosPorMes] = useState<Record<string, DatosMes>>({});
```

con `import { listaMeses } from '@/lib/historia-meses';`.

3. Efectos (después del efecto del vuelo):

```ts
// Al entrar al modo historia: traer el rango disponible una sola vez.
useEffect(() => {
  if (modo !== 'historia' || mesesHistoria !== null) return;
  let cancelado = false;
  fetch('/api/jefe/historia')
    .then((r) => r.json())
    .then((json) => {
      if (cancelado || !json.ok) return;
      const meses = listaMeses(json.data.desde, json.data.hasta);
      setMesesHistoria(meses);
      setIndiceMes(meses.length - 1); // arranca en el mes actual
    })
    .catch(() => {
      if (!cancelado) setMesesHistoria([]);
    });
  return () => {
    cancelado = true;
  };
}, [modo, mesesHistoria]);

// Traer los datos del mes elegido (con cache en memoria por mes).
const mesElegido = mesesHistoria?.[indiceMes] ?? null;
useEffect(() => {
  if (modo !== 'historia' || !mesElegido || datosPorMes[mesElegido]) return;
  let cancelado = false;
  fetch(`/api/jefe/historia?mes=${mesElegido}`)
    .then((r) => r.json())
    .then((json) => {
      if (cancelado || !json.ok) return;
      setDatosPorMes((prev) => ({ ...prev, [mesElegido]: json.data }));
    })
    .catch(() => undefined);
  return () => {
    cancelado = true;
  };
}, [modo, mesElegido, datosPorMes]);

const datosMes = mesElegido ? datosPorMes[mesElegido] ?? null : null;
```

4. Recolorear los lotes en modo historia — reemplazar el `useMemo` de `lotesMapa` para que use los kg del mes elegido cuando aplica:

```ts
const lotesMapa: LoteMapa3D[] = useMemo(() => {
  const kgHistoria = new Map<string, number>();
  if (modo === 'historia' && datosMes) {
    for (const c of datosMes.cosecha_por_lote) kgHistoria.set(c.lote_id, c.kg);
  }
  const fuenteKg = modo === 'historia' ? kgHistoria : kgPorLote;
  const maxKg = Math.max(0, ...Array.from(fuenteKg.values()));
  return geo.lotesParaMapa
    .filter((l): l is typeof l & { geojson: NonNullable<typeof l.geojson> } => l.geojson !== null)
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      estado: estadoPorLote.get(l.id) ?? 'aldia',
      kgMes: fuenteKg.get(l.id) ?? 0,
      colorCosecha: rampaCosecha(fuenteKg.get(l.id) ?? 0, maxKg),
      trabajandoHoy: (equipoPorLote.get(l.id) ?? []).length,
      geojson: l.geojson,
    }));
}, [geo.lotesParaMapa, estadoPorLote, kgPorLote, equipoPorLote, modo, datosMes]);
```

5. En el bloque inferior, el modo historia muestra el slider (entre el vuelo y el panel de lote):

```tsx
        {vuelo && loteEnVuelo ? (
          <VueloDron ... (igual que antes) />
        ) : modo === 'historia' && mesesHistoria && mesesHistoria.length > 0 ? (
          <HistoriaSlider
            meses={mesesHistoria}
            indice={indiceMes}
            onCambio={setIndiceMes}
            totalKg={datosMes?.total_kg ?? 0}
            tareas={datosMes?.tareas_completadas ?? 0}
            novedades={datosMes?.novedades ?? 0}
            cargando={datosMes === null}
          />
        ) : loteSel ? (
```

- [ ] **Step 5:** `npm run check:types && npm run lint && npm run build` → verde.

- [ ] **Step 6: Verificación manual** — `npm run dev` → `/jefe`:

1. Chip "Historia" → aparece el slider abajo, arranca en el mes actual.
2. Arrastrar el slider → los lotes se recolorean según los kg de ese mes; los contadores cambian.
3. Flechas ←/→ navegan mes a mes; meses ya visitados cambian instantáneo (cache en memoria).
4. Volver a "Tareas" → semáforo normal y dock de vuelta.

- [ ] **Step 7: Commit**

```bash
git add components/mapa3d/HistoriaSlider.tsx components/mapa3d/Mapa3D.tsx components/mapa3d/ChipsModos.tsx components/mapa3d/CentroControl.tsx
git commit -m "feat: máquina del tiempo con slider mensual sobre el mapa"
```

---

### Task 4: Verificación final

- [ ] **Step 1:** `npm run ci` → verde (84 tests).
- [ ] **Step 2:** Merge a main + push.
