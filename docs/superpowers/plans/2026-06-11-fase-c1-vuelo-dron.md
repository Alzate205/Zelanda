# Fase C1 — Vuelo de Dron: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón en el centro de control inicia un tour cinematográfico automático: la cámara vuela lote por lote (ordenados por cercanía geográfica) mostrando el dato clave de cada uno, con pausa y salida (spec: `docs/superpowers/specs/2026-06-10-zelanda-2-0-design.md`, Fase C1).

**Architecture:** `lib/ruta-dron.ts` (puro, testeado) ordena los lotes por vecino más cercano. `Mapa3D` expone `volarA()` vía `forwardRef`/`useImperativeHandle`. `CentroControl` orquesta el tour con un estado `{ruta, indice, pausado}` y timers; `VueloDron.tsx` es la tarjeta overlay con el lote actual y los controles. Sin dependencias nuevas, sin BD.

**Tech Stack:** maplibre-gl (flyTo encadenados), React 19.

---

## Mapa de archivos

| Archivo                               | Acción | Responsabilidad                                                |
| ------------------------------------- | ------ | -------------------------------------------------------------- |
| `lib/ruta-dron.ts`                    | Create | `ordenarPorCercania` (vecino más cercano sobre centroides)     |
| `lib/ruta-dron.test.ts`               | Create | Tests del orden de la ruta                                     |
| `components/mapa3d/Mapa3D.tsx`        | Modify | forwardRef + `volarA()` imperativo                             |
| `components/mapa3d/VueloDron.tsx`     | Create | Tarjeta overlay del tour (lote actual, n/total, pausar, salir) |
| `components/mapa3d/CentroControl.tsx` | Modify | Botón de inicio, estado del tour, timers                       |

---

### Task 1: Ruta del dron (TDD)

**Files:**

- Create: `lib/ruta-dron.ts`
- Test: `lib/ruta-dron.test.ts`

- [ ] **Step 1: Test que falla**

Crear `lib/ruta-dron.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ordenarPorCercania } from './ruta-dron';

describe('ordenarPorCercania', () => {
  it('ordena por vecino más cercano partiendo del primero', () => {
    // a en 0, c en 1, b en 5 (sobre una línea): desde a lo más cercano es c
    const ruta = ordenarPorCercania([
      { id: 'a', centro: [0, 0] },
      { id: 'b', centro: [5, 0] },
      { id: 'c', centro: [1, 0] },
    ]);
    expect(ruta).toEqual(['a', 'c', 'b']);
  });

  it('lista vacía devuelve vacío', () => {
    expect(ordenarPorCercania([])).toEqual([]);
  });

  it('un solo lote devuelve ese lote', () => {
    expect(ordenarPorCercania([{ id: 'x', centro: [1, 1] }])).toEqual(['x']);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/ruta-dron.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `lib/ruta-dron.ts`**

```ts
// Orden de visita del vuelo de dron: vecino más cercano sobre los
// centroides. Para 15 lotes es más que suficiente y es determinista.

export function ordenarPorCercania(paradas: { id: string; centro: [number, number] }[]): string[] {
  if (paradas.length === 0) return [];
  const pendientes = [...paradas];
  const ruta: string[] = [];
  let actual = pendientes.shift() as (typeof paradas)[number];
  ruta.push(actual.id);
  while (pendientes.length > 0) {
    let mejor = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const dx = pendientes[i].centro[0] - actual.centro[0];
      const dy = pendientes[i].centro[1] - actual.centro[1];
      const d = dx * dx + dy * dy;
      if (d < mejorDist) {
        mejorDist = d;
        mejor = i;
      }
    }
    actual = pendientes.splice(mejor, 1)[0];
    ruta.push(actual.id);
  }
  return ruta;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run lib/ruta-dron.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ruta-dron.ts lib/ruta-dron.test.ts
git commit -m "feat: orden de ruta del vuelo de dron por vecino más cercano"
```

---

### Task 2: `volarA()` imperativo en Mapa3D

**Files:**

- Modify: `components/mapa3d/Mapa3D.tsx`

- [ ] **Step 1: Exponer la manija**

1. Cambiar imports de React:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
```

2. Agregar el tipo exportado (junto a `LoteMapa3D`):

```ts
export type ManijaMapa3D = {
  volarA: (opts: {
    center: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) => void;
};
```

3. Convertir el componente a forwardRef — la firma cambia de:

```ts
export default function Mapa3D({ lotes, ... }: { ... }) {
```

a:

```ts
const Mapa3D = forwardRef<ManijaMapa3D, PropsMapa3D>(function Mapa3D(
  { lotes, bordeFinca, apiarios, modo, onSeleccionLote, onError },
  ref,
) {
```

con el tipo de props extraído:

```ts
type PropsMapa3D = {
  lotes: LoteMapa3D[];
  bordeFinca: GeoJsonPolygon | null;
  apiarios: { id: string; nombre: string; geojson: GeoJsonPoint | null }[];
  modo: ModoMapa;
  onSeleccionLote: (id: string | null) => void;
  onError: () => void;
};
```

y al final del componente (antes del `return <div .../>`):

```ts
useImperativeHandle(ref, () => ({
  volarA(opts) {
    const map = mapRef.current;
    if (!map || !cargadoRef.current) return;
    map.flyTo({
      center: opts.center,
      zoom: opts.zoom ?? map.getZoom(),
      bearing: opts.bearing ?? map.getBearing(),
      pitch: opts.pitch ?? map.getPitch(),
      duration: opts.duration ?? 2600,
      essential: true,
    });
  },
}));
```

cerrando con:

```ts
});

export default Mapa3D;
```

- [ ] **Step 2: Verificar tipos y commit**

Run: `npm run check:types && npm run lint`
Expected: verde.

```bash
git add components/mapa3d/Mapa3D.tsx
git commit -m "feat: Mapa3D expone volarA() para el vuelo de dron"
```

---

### Task 3: Tarjeta VueloDron

**Files:**

- Create: `components/mapa3d/VueloDron.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';

import { Pause, Play, X } from 'lucide-react';
import { COLOR_ESTADO_LOTE, type EstadoLote } from '@/lib/mapa3d';
import type { LoteMapa3D } from './Mapa3D';

const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  aldia: 'Al día',
  proxima: 'Tarea próxima',
  vencida: 'Tarea vencida',
};

export function VueloDron({
  lote,
  numero,
  total,
  pausado,
  onPausar,
  onSalir,
}: {
  lote: LoteMapa3D;
  numero: number;
  total: number;
  pausado: boolean;
  onPausar: () => void;
  onSalir: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Vuelo de dron · {numero}/{total}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onPausar}
            aria-label={pausado ? 'Reanudar vuelo' : 'Pausar vuelo'}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-zelanda-verde-700 text-zelanda-beige-50"
          >
            {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onSalir}
            aria-label="Salir del vuelo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <h2 className="m-0 mt-1 font-serif text-xl text-zelanda-verde-900">{lote.nombre}</h2>
      <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[12.5px] text-zelanda-verde-800">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: COLOR_ESTADO_LOTE[lote.estado] }}
          aria-hidden
        />
        {ETIQUETA_ESTADO[lote.estado]}
        {' · '}
        {Math.round(lote.kgMes).toLocaleString('es-CO')} kg este mes
        {lote.trabajandoHoy > 0 ? ` · ${lote.trabajandoHoy} trabajando hoy` : ''}
      </p>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-zelanda-beige-200">
        <div
          className="h-full rounded-full bg-zelanda-verde-600 transition-all duration-700"
          style={{ width: `${Math.round((numero / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y commit**

Run: `npm run check:types && npm run lint`
Expected: verde.

```bash
git add components/mapa3d/VueloDron.tsx
git commit -m "feat: tarjeta overlay del vuelo de dron"
```

---

### Task 4: Orquestación en CentroControl

**Files:**

- Modify: `components/mapa3d/CentroControl.tsx`

- [ ] **Step 1: Estado y lógica del vuelo**

1. Imports nuevos:

```ts
import { Plane } from 'lucide-react';
import Mapa3D, { type LoteMapa3D, type ManijaMapa3D, type ModoMapa } from './Mapa3D';
import { VueloDron } from './VueloDron';
import { ordenarPorCercania } from '@/lib/ruta-dron';
import { centroideDePoligono, rampaCosecha, type EstadoLote } from '@/lib/mapa3d';
```

2. Estado y ref (junto a los useState existentes):

```ts
type EstadoVuelo = { ruta: string[]; indice: number; pausado: boolean };
const [vuelo, setVuelo] = useState<EstadoVuelo | null>(null);
const mapaRef = useRef<ManijaMapa3D>(null);
```

3. Lógica (después del cálculo de `lotesMapa`):

```ts
function iniciarVuelo() {
  if (lotesMapa.length === 0) return;
  setLoteId(null);
  setPanelAbierto(false);
  const ruta = ordenarPorCercania(
    lotesMapa.map((l) => ({ id: l.id, centro: centroideDePoligono(l.geojson) }))
  );
  setVuelo({ ruta, indice: 0, pausado: false });
}

// Cada parada: volar (2.6 s) + contemplar (2.6 s) y pasar a la siguiente.
useEffect(() => {
  if (!vuelo || vuelo.pausado) return;
  const lote = lotesMapa.find((l) => l.id === vuelo.ruta[vuelo.indice]);
  if (!lote) {
    setVuelo(null);
    return;
  }
  mapaRef.current?.volarA({
    center: centroideDePoligono(lote.geojson),
    zoom: 15.3,
    pitch: 58,
    bearing: -15 + vuelo.indice * 30,
    duration: 2600,
  });
  const timer = setTimeout(() => {
    setVuelo((v) =>
      v === null || v.indice >= v.ruta.length - 1 ? null : { ...v, indice: v.indice + 1 }
    );
  }, 5200);
  return () => clearTimeout(timer);
}, [vuelo, lotesMapa]);

const loteEnVuelo = vuelo ? lotesMapa.find((l) => l.id === vuelo.ruta[vuelo.indice]) ?? null : null;
```

4. Pasar el ref al mapa:

```tsx
        <Mapa3D
          ref={mapaRef}
          ...
```

5. Botón de inicio — en el bloque "Saludo + chips", debajo de `<ChipsModos …/>` (solo con WebGL y sin vuelo activo):

```tsx
{
  conWebGL === true && !vuelo ? (
    <button
      type="button"
      onClick={iniciarVuelo}
      className="pointer-events-auto flex items-center gap-1.5 self-start rounded-full border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-1.5 text-xs font-medium text-zelanda-verde-800 shadow-suave backdrop-blur-md"
    >
      <Plane className="h-3.5 w-3.5" aria-hidden />
      Vuelo de dron
    </button>
  ) : null;
}
```

6. En el bloque inferior (dock / panel de lote), el vuelo tiene prioridad:

```tsx
      <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
        {vuelo && loteEnVuelo ? (
          <VueloDron
            lote={loteEnVuelo}
            numero={vuelo.indice + 1}
            total={vuelo.ruta.length}
            pausado={vuelo.pausado}
            onPausar={() => setVuelo((v) => (v ? { ...v, pausado: !v.pausado } : v))}
            onSalir={() => setVuelo(null)}
          />
        ) : loteSel ? (
          <PanelLote ... (igual que antes) />
        ) : (
          <DockKPIs ... (igual que antes) />
        )}
      </div>
```

7. Al seleccionar un lote tocándolo durante el vuelo, salir del vuelo: en el callback `onSeleccionLote` del Mapa3D, cambiar `onSeleccionLote={setLoteId}` por:

```tsx
          onSeleccionLote={(id) => {
            setVuelo(null);
            setLoteId(id);
          }}
```

- [ ] **Step 2: Verificar**

Run: `npm run check:types && npm run lint && npm run build`
Expected: verde.

Run: `npm run dev` → `/jefe` como jefe:

1. Botón "Vuelo de dron" bajo los chips.
2. Al tocarlo: la cámara vuela al primer lote, espera, sigue al siguiente; la tarjeta inferior muestra lote, n/total y barra de progreso.
3. Pausar congela; reanudar sigue donde iba.
4. X o tocar un lote sale del vuelo y restaura dock/panel.
5. Termina solo después del último lote.

- [ ] **Step 3: Commit**

```bash
git add components/mapa3d/CentroControl.tsx
git commit -m "feat: vuelo de dron cinematográfico sobre los lotes"
```

---

### Task 5: Verificación final

- [ ] **Step 1:** `npm run ci` → verde (81 tests).
- [ ] **Step 2:** Checklist manual del usuario en celular (fluidez del vuelo en gama media).
- [ ] **Step 3:** Merge a main + push (vía finishing-a-development-branch).
