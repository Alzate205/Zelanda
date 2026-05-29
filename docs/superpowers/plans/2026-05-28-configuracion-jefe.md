# Configuración del Jefe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel `/jefe/configuracion` donde el JEFE preconfigura parámetros de la finca (cosecha, alertas, bodega, financiero), con consumo de esos valores en los formularios correspondientes.

**Architecture:** Tabla `configuracion_finca` con una sola fila tipada. Helper `lib/configuracion.ts` con `obtenerConfiguracion()`. Server Action `guardarConfiguracion()` hace upsert. Los valores reemplazan constantes hardcodeadas en formularios y lógica de alertas.

**Tech Stack:** Next.js 15 App Router, Prisma, PostgreSQL (Supabase), Server Actions, TypeScript, Tailwind CSS, Lucide React.

---

## File Map

| Archivo                                                    | Acción                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `supabase/migracion-configuracion-finca.sql`               | Crear — migration SQL                                   |
| `prisma/schema.prisma`                                     | Modificar — agregar model `configuracion_finca`         |
| `lib/configuracion.ts`                                     | Crear — helper `obtenerConfiguracion()`                 |
| `app/(app)/jefe/configuracion/acciones.ts`                 | Crear — Server Action `guardarConfiguracion`            |
| `app/(app)/jefe/configuracion/page.tsx`                    | Crear — Server Component                                |
| `app/(app)/jefe/configuracion/FormularioConfiguracion.tsx` | Crear — Client Component formulario                     |
| `app/(app)/jefe/_dashboard-cliente.tsx`                    | Modificar — agregar atajo Configuración                 |
| `app/(app)/almacen/cosecha/nueva/page.tsx`                 | Modificar — pasar `canastaPorDefecto` al formulario     |
| `app/(app)/almacen/cosecha/nueva/_formulario.tsx`          | Modificar — aceptar prop `canastaPorDefecto`            |
| `lib/fechas-tarea.ts`                                      | Modificar — `calcularResumen` acepta `diasAlerta` param |
| `app/api/trabajador/snapshot/route.ts`                     | Modificar — pasar `diasAlerta` desde config             |
| `app/(app)/bodega/inventario/insumos/_formulario.tsx`      | Modificar — aceptar prop `stockMinimoDefault`           |
| `app/(app)/jefe/equipo/nuevo/page.tsx`                     | Modificar — leer config y pasar defaults                |
| `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`   | Modificar — aceptar props de defaults financieros       |

---

## Task 1: Migración SQL y modelo Prisma

**Files:**

- Create: `supabase/migracion-configuracion-finca.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Crear archivo de migración**

Crear `supabase/migracion-configuracion-finca.sql` con este contenido exacto:

```sql
-- Panel de configuración del jefe: parámetros operativos de la finca
CREATE TABLE IF NOT EXISTS configuracion_finca (
  id                           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Cosecha: kg por canasta por defecto (método CANASTA)
  canasta_kg_default           NUMERIC(8,2)   NOT NULL DEFAULT 23,

  -- Alertas: días de anticipación para considerar tarea "próxima a vencer"
  alerta_dias_anticipacion     INT            NOT NULL DEFAULT 7,

  -- Bodega: hora de corte HH:MM para alertar despachos abiertos
  despacho_hora_corte          TEXT           NOT NULL DEFAULT '17:00',

  -- Bodega: stock mínimo por defecto al crear insumos nuevos
  insumo_stock_minimo_default  NUMERIC(10,3)  NOT NULL DEFAULT 0,

  -- Financiero: defaults al crear trabajadores (nullable, solo pre-rellenan)
  jornal_tarifa_default        NUMERIC(12,2),
  fijo_salario_default         NUMERIC(12,2),
  fijo_periodo_pago_default    tipo_periodo_pago,

  -- Datos de la finca (para reportes futuros)
  finca_nombre                 TEXT           NOT NULL DEFAULT 'Hacienda La Zelanda',
  finca_telefono               TEXT,
  finca_correo                 TEXT,

  -- Auditoría
  updated_at                   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_by                   UUID           REFERENCES auth.users(id)
);

-- Garantizar que siempre existe la fila con defaults
INSERT INTO configuracion_finca DEFAULT VALUES ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE configuracion_finca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jefe_lee_config" ON configuracion_finca
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );

CREATE POLICY "jefe_modifica_config" ON configuracion_finca
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );
```

- [ ] **Step 2: Agregar modelo en `prisma/schema.prisma`**

Al final del schema (antes del último `}` o junto a los otros modelos), agregar:

```prisma
model configuracion_finca {
  id                          Int              @id @default(1)
  canasta_kg_default          Decimal          @db.Decimal(8, 2)
  alerta_dias_anticipacion    Int
  despacho_hora_corte         String
  insumo_stock_minimo_default Decimal          @db.Decimal(10, 3)
  jornal_tarifa_default       Decimal?         @db.Decimal(12, 2)
  fijo_salario_default        Decimal?         @db.Decimal(12, 2)
  fijo_periodo_pago_default   TipoPeriodoPago?
  finca_nombre                String
  finca_telefono              String?
  finca_correo                String?
  updated_at                  DateTime         @default(now()) @db.Timestamptz
  updated_by                  String?          @db.Uuid
  updated_by_u                usuarios?        @relation("config_updated_by", fields: [updated_by], references: [id])

  @@schema("public")
}
```

Y en el modelo `usuarios`, agregar la back-relation (busca el bloque del model `usuarios` y agrega al final de sus campos):

```prisma
  config_actualizada configuracion_finca[] @relation("config_updated_by")
```

- [ ] **Step 3: Regenerar cliente Prisma**

```powershell
npx prisma generate
```

Debe completar sin errores. Si lanza error `EPERM` en Windows por DLL bloqueada, detener el dev server primero y volver a ejecutar.

- [ ] **Step 4: Verificar tipos**

```powershell
npm run check:types
```

Debe pasar sin errores relacionados a `configuracion_finca`.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migracion-configuracion-finca.sql prisma/schema.prisma
git commit -m "feat: agregar tabla configuracion_finca y modelo Prisma"
```

---

## Task 2: Helper `lib/configuracion.ts`

**Files:**

- Create: `lib/configuracion.ts`

- [ ] **Step 1: Crear el helper**

Crear `lib/configuracion.ts`:

```typescript
import 'server-only';
import { prisma } from './prisma';

export async function obtenerConfiguracion() {
  const config = await prisma.configuracion_finca.findUnique({ where: { id: 1 } });
  if (!config) throw new Error('Fila configuracion_finca no encontrada. Corré la migración.');
  return config;
}
```

- [ ] **Step 2: Verificar tipos**

```powershell
npm run check:types
```

Debe pasar sin errores en `lib/configuracion.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/configuracion.ts
git commit -m "feat: helper obtenerConfiguracion"
```

---

## Task 3: Server Action `guardarConfiguracion`

**Files:**

- Create: `app/(app)/jefe/configuracion/acciones.ts`

- [ ] **Step 1: Crear el archivo**

Crear `app/(app)/jefe/configuracion/acciones.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requerirUsuario } from '@/lib/auth';
import { sanitizarError } from '@/lib/errores';
import type { TipoPeriodoPago } from '@prisma/client';

export type EstadoConfig = { error: string | null };

const PERIODOS_VALIDOS: TipoPeriodoPago[] = ['MENSUAL', 'QUINCENAL', 'SEMANAL'];

export async function guardarConfiguracion(
  _prev: EstadoConfig,
  formData: FormData
): Promise<EstadoConfig> {
  const usuario = await requerirUsuario('JEFE');

  const fincaNombre = String(formData.get('finca_nombre') ?? '').trim();
  const fincaTelefono = String(formData.get('finca_telefono') ?? '').trim();
  const fincaCorreo = String(formData.get('finca_correo') ?? '').trim();

  const canastasRaw = String(formData.get('canasta_kg_default') ?? '').trim();
  const alertaDiasRaw = String(formData.get('alerta_dias_anticipacion') ?? '').trim();
  const horaCierre = String(formData.get('despacho_hora_corte') ?? '').trim();
  const stockMinimoRaw = String(formData.get('insumo_stock_minimo_default') ?? '').trim();

  const jornalTarifaRaw = String(formData.get('jornal_tarifa_default') ?? '').trim();
  const fijeSalarioRaw = String(formData.get('fijo_salario_default') ?? '').trim();
  const fijoPeriodoRaw = String(formData.get('fijo_periodo_pago_default') ?? '').trim();

  if (!fincaNombre) return { error: 'El nombre de la finca no puede estar vacío.' };

  const canasta = Number(canastasRaw.replace(/\./g, ''));
  if (!Number.isFinite(canasta) || canasta <= 0) {
    return { error: 'Capacidad de canasta debe ser mayor a 0.' };
  }

  const alertaDias = parseInt(alertaDiasRaw, 10);
  if (!Number.isFinite(alertaDias) || alertaDias < 1 || alertaDias > 60) {
    return { error: 'Días de anticipación debe estar entre 1 y 60.' };
  }

  if (!/^\d{2}:\d{2}$/.test(horaCierre)) {
    return { error: 'Hora de corte debe tener formato HH:MM.' };
  }

  const stockMinimo = Number(stockMinimoRaw.replace(/\./g, ''));
  if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
    return { error: 'Stock mínimo por defecto debe ser 0 o mayor.' };
  }

  let jornalTarifa: number | null = null;
  if (jornalTarifaRaw) {
    jornalTarifa = Number(jornalTarifaRaw.replace(/\./g, ''));
    if (!Number.isFinite(jornalTarifa) || jornalTarifa <= 0) {
      return { error: 'Tarifa jornal por defecto debe ser mayor a 0.' };
    }
  }

  let fijoSalario: number | null = null;
  if (fijeSalarioRaw) {
    fijoSalario = Number(fijeSalarioRaw.replace(/\./g, ''));
    if (!Number.isFinite(fijoSalario) || fijoSalario <= 0) {
      return { error: 'Salario base por defecto debe ser mayor a 0.' };
    }
  }

  const fijoPeriodo: TipoPeriodoPago | null =
    fijoPeriodoRaw && PERIODOS_VALIDOS.includes(fijoPeriodoRaw as TipoPeriodoPago)
      ? (fijoPeriodoRaw as TipoPeriodoPago)
      : null;

  try {
    await prisma.configuracion_finca.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        finca_nombre: fincaNombre,
        finca_telefono: fincaTelefono || null,
        finca_correo: fincaCorreo || null,
        canasta_kg_default: canasta,
        alerta_dias_anticipacion: alertaDias,
        despacho_hora_corte: horaCierre,
        insumo_stock_minimo_default: stockMinimo,
        jornal_tarifa_default: jornalTarifa,
        fijo_salario_default: fijoSalario,
        fijo_periodo_pago_default: fijoPeriodo,
        updated_by: usuario.id,
      },
      update: {
        finca_nombre: fincaNombre,
        finca_telefono: fincaTelefono || null,
        finca_correo: fincaCorreo || null,
        canasta_kg_default: canasta,
        alerta_dias_anticipacion: alertaDias,
        despacho_hora_corte: horaCierre,
        insumo_stock_minimo_default: stockMinimo,
        jornal_tarifa_default: jornalTarifa,
        fijo_salario_default: fijoSalario,
        fijo_periodo_pago_default: fijoPeriodo,
        updated_at: new Date(),
        updated_by: usuario.id,
      },
    });
  } catch (e) {
    return { error: sanitizarError(e, 'configuracion/guardar') };
  }

  revalidatePath('/jefe/configuracion');
  return { error: null };
}
```

- [ ] **Step 2: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 3: Commit**

```powershell
git add app/(app)/jefe/configuracion/acciones.ts
git commit -m "feat: server action guardarConfiguracion"
```

---

## Task 4: Formulario cliente `FormularioConfiguracion.tsx`

**Files:**

- Create: `app/(app)/jefe/configuracion/FormularioConfiguracion.tsx`

- [ ] **Step 1: Crear el Client Component**

Crear `app/(app)/jefe/configuracion/FormularioConfiguracion.tsx`:

```typescript
'use client';

import { useActionState } from 'react';
import { guardarConfiguracion, type EstadoConfig } from './acciones';
import { formatearMiles } from '@/lib/formatos';
import type { TipoPeriodoPago } from '@prisma/client';

type Props = {
  config: {
    finca_nombre: string;
    finca_telefono: string | null;
    finca_correo: string | null;
    canasta_kg_default: number;
    alerta_dias_anticipacion: number;
    despacho_hora_corte: string;
    insumo_stock_minimo_default: number;
    jornal_tarifa_default: number | null;
    fijo_salario_default: number | null;
    fijo_periodo_pago_default: TipoPeriodoPago | null;
  };
};

const inputClase =
  'mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';
const labelClase = 'block text-sm font-medium text-zelanda-verde-900';

export function FormularioConfiguracion({ config }: Props) {
  const [estado, accion, pending] = useActionState<EstadoConfig, FormData>(guardarConfiguracion, {
    error: null,
  });

  return (
    <form action={accion} className="space-y-5">
      {estado.error && (
        <p className="rounded-xl bg-estado-vencida/10 px-4 py-3 text-sm text-estado-vencida">
          {estado.error}
        </p>
      )}

      {/* Sección: Finca */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Datos de la finca</h2>
        <div>
          <label htmlFor="finca_nombre" className={labelClase}>
            Nombre oficial
          </label>
          <input
            id="finca_nombre"
            name="finca_nombre"
            type="text"
            required
            defaultValue={config.finca_nombre}
            className={inputClase}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="finca_telefono" className={labelClase}>
              Teléfono
            </label>
            <input
              id="finca_telefono"
              name="finca_telefono"
              type="tel"
              defaultValue={config.finca_telefono ?? ''}
              className={inputClase}
            />
          </div>
          <div>
            <label htmlFor="finca_correo" className={labelClase}>
              Correo
            </label>
            <input
              id="finca_correo"
              name="finca_correo"
              type="email"
              defaultValue={config.finca_correo ?? ''}
              className={inputClase}
            />
          </div>
        </div>
      </section>

      {/* Sección: Cosecha */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Cosecha</h2>
        <div>
          <label htmlFor="canasta_kg_default" className={labelClase}>
            Capacidad por canasta (kg)
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            Se usa para calcular el peso al registrar cosecha por canastas.
          </p>
          <input
            id="canasta_kg_default"
            name="canasta_kg_default"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            defaultValue={config.canasta_kg_default}
            className={inputClase}
          />
        </div>
      </section>

      {/* Sección: Alertas y Bodega */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Alertas y Bodega</h2>
        <div>
          <label htmlFor="alerta_dias_anticipacion" className={labelClase}>
            Días de anticipación para alertas de tareas
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            Cuántos días antes del vencimiento se muestra la tarea como "próxima".
          </p>
          <input
            id="alerta_dias_anticipacion"
            name="alerta_dias_anticipacion"
            type="number"
            inputMode="numeric"
            min="1"
            max="60"
            required
            defaultValue={config.alerta_dias_anticipacion}
            className={inputClase}
          />
        </div>
        <div>
          <label htmlFor="despacho_hora_corte" className={labelClase}>
            Hora de corte de despachos (HH:MM)
          </label>
          <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
            A partir de esta hora se alerta sobre despachos abiertos sin cerrar.
          </p>
          <input
            id="despacho_hora_corte"
            name="despacho_hora_corte"
            type="time"
            required
            defaultValue={config.despacho_hora_corte}
            className={inputClase}
          />
        </div>
        <div>
          <label htmlFor="insumo_stock_minimo_default" className={labelClase}>
            Stock mínimo por defecto (al crear insumos)
          </label>
          <input
            id="insumo_stock_minimo_default"
            name="insumo_stock_minimo_default"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            required
            defaultValue={config.insumo_stock_minimo_default}
            className={inputClase}
          />
        </div>
      </section>

      {/* Sección: Financiero */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave space-y-4">
        <h2 className="font-serif text-base text-zelanda-verde-900">Financiero</h2>
        <p className="text-[11.5px] text-zelanda-verde-700">
          Estos valores pre-rellenan los campos al crear trabajadores nuevos. No son obligatorios.
        </p>
        <div>
          <label htmlFor="jornal_tarifa_default" className={labelClase}>
            Tarifa jornal por defecto (COP)
          </label>
          <input
            id="jornal_tarifa_default"
            name="jornal_tarifa_default"
            type="text"
            inputMode="numeric"
            defaultValue={
              config.jornal_tarifa_default != null
                ? formatearMiles(config.jornal_tarifa_default)
                : ''
            }
            placeholder="Ej. 50.000"
            className={inputClase}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fijo_salario_default" className={labelClase}>
              Salario base FIJO por defecto (COP)
            </label>
            <input
              id="fijo_salario_default"
              name="fijo_salario_default"
              type="text"
              inputMode="numeric"
              defaultValue={
                config.fijo_salario_default != null
                  ? formatearMiles(config.fijo_salario_default)
                  : ''
              }
              placeholder="Ej. 1.500.000"
              className={inputClase}
            />
          </div>
          <div>
            <label htmlFor="fijo_periodo_pago_default" className={labelClase}>
              Período por defecto
            </label>
            <select
              id="fijo_periodo_pago_default"
              name="fijo_periodo_pago_default"
              defaultValue={config.fijo_periodo_pago_default ?? ''}
              className={inputClase}
            >
              <option value="">— Sin default —</option>
              <option value="MENSUAL">Mensual</option>
              <option value="QUINCENAL">Quincenal</option>
              <option value="SEMANAL">Semanal</option>
            </select>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-touch rounded-xl bg-zelanda-verde-700 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900)]"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(app)/jefe/configuracion/FormularioConfiguracion.tsx"
git commit -m "feat: formulario UI configuracion del jefe"
```

---

## Task 5: Página `/jefe/configuracion`

**Files:**

- Create: `app/(app)/jefe/configuracion/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/(app)/jefe/configuracion/page.tsx`:

```typescript
import Link from 'next/link';
import { ChevronLeft, Settings } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { FormularioConfiguracion } from './FormularioConfiguracion';

export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion() {
  await requerirUsuario('JEFE');
  const config = await obtenerConfiguracion();

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
        <Eyebrow>Finca · Configuración</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Configuración</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Parámetros operativos y valores por defecto de la finca.
        </p>
      </header>

      <FormularioConfiguracion
        config={{
          finca_nombre: config.finca_nombre,
          finca_telefono: config.finca_telefono,
          finca_correo: config.finca_correo,
          canasta_kg_default: Number(config.canasta_kg_default),
          alerta_dias_anticipacion: config.alerta_dias_anticipacion,
          despacho_hora_corte: config.despacho_hora_corte,
          insumo_stock_minimo_default: Number(config.insumo_stock_minimo_default),
          jornal_tarifa_default:
            config.jornal_tarifa_default != null ? Number(config.jornal_tarifa_default) : null,
          fijo_salario_default:
            config.fijo_salario_default != null ? Number(config.fijo_salario_default) : null,
          fijo_periodo_pago_default: config.fijo_periodo_pago_default,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(app)/jefe/configuracion/page.tsx"
git commit -m "feat: pagina /jefe/configuracion"
```

---

## Task 6: Atajo en dashboard del jefe

**Files:**

- Modify: `app/(app)/jefe/_dashboard-cliente.tsx`

- [ ] **Step 1: Abrir el archivo y localizar la sección de atajos "Más"**

Leer `app/(app)/jefe/_dashboard-cliente.tsx`. Buscar el bloque donde están los atajos de Compras y Proveedores (cerca de las líneas 293-343 según la exploración previa). El componente `<Atajo>` recibe `href`, `icono`, `titulo`, `sub`.

- [ ] **Step 2: Agregar import de `Settings`**

En la línea de imports de `lucide-react`, agregar `Settings`:

```typescript
import { /* otros iconos existentes */, Settings } from 'lucide-react';
```

- [ ] **Step 3: Agregar el atajo Configuración**

Al final del bloque de atajos de la sección "Más" (después del atajo de Reportes o Apiarios), agregar:

```tsx
<Atajo
  href="/jefe/configuracion"
  icono={<Settings className="h-5 w-5" />}
  titulo="Configuración"
  sub="Parámetros de la finca"
/>
```

- [ ] **Step 4: Verificar tipos y commit**

```powershell
npm run check:types
git add "app/(app)/jefe/_dashboard-cliente.tsx"
git commit -m "feat: atajo Configuracion en dashboard del jefe"
```

---

## Task 7: Consumir `canasta_kg_default` en formulario de cosecha

**Files:**

- Modify: `app/(app)/almacen/cosecha/nueva/page.tsx`
- Modify: `app/(app)/almacen/cosecha/nueva/_formulario.tsx`

- [ ] **Step 1: Leer ambos archivos**

Leer `app/(app)/almacen/cosecha/nueva/page.tsx` y `app/(app)/almacen/cosecha/nueva/_formulario.tsx` para entender la interfaz actual entre page y formulario.

- [ ] **Step 2: Modificar `page.tsx` para pasar `canastaPorDefecto`**

En `app/(app)/almacen/cosecha/nueva/page.tsx`, importar `obtenerConfiguracion` y pasar el valor al formulario:

```typescript
import { obtenerConfiguracion } from '@/lib/configuracion';

// En el body del Server Component, antes del return:
const config = await obtenerConfiguracion();

// En el JSX, pasar la prop al formulario:
<FormularioCosecha
  // ...props existentes...
  canastaPorDefecto={Number(config.canasta_kg_default)}
/>;
```

- [ ] **Step 3: Modificar `_formulario.tsx` para aceptar y usar la prop**

En `app/(app)/almacen/cosecha/nueva/_formulario.tsx`:

1. Agregar `canastaPorDefecto: number` a la interfaz de Props (o al tipo de parámetros si no hay interfaz).

2. Buscar la inicialización del estado `capacidad` (actualmente `useState("")`). Cambiar a:

```typescript
const [capacidad, setCapacidad] = useState(canastaPorDefecto > 0 ? String(canastaPorDefecto) : '');
```

3. Asegurarse de que `canastaPorDefecto` se recibe como prop del componente.

- [ ] **Step 4: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 5: Commit**

```powershell
git add "app/(app)/almacen/cosecha/nueva/page.tsx" "app/(app)/almacen/cosecha/nueva/_formulario.tsx"
git commit -m "feat: pre-rellenar capacidad de canasta desde configuracion"
```

---

## Task 8: Consumir `alerta_dias_anticipacion` en lógica de alertas

**Files:**

- Modify: `lib/fechas-tarea.ts`
- Modify: `app/api/trabajador/snapshot/route.ts`

- [ ] **Step 1: Modificar `lib/fechas-tarea.ts`**

Leer el archivo. En la función `calcularResumen` (línea 14), agregar un 4° parámetro con default 7:

```typescript
export function calcularResumen(
  ultimaCompletada: Date | null,
  frecuenciaDias: number,
  ahora: Date = new Date(),
  diasAlerta: number = 7,
): ResumenTarea {
  // ... código existente ...
  // En la línea que tiene `else if (dias <= 7)`, cambiar a:
  else if (dias <= diasAlerta) estado = "proxima";
  // ... resto igual ...
}
```

El 4° parámetro tiene `default = 7`, así todos los callers existentes siguen funcionando sin cambios.

- [ ] **Step 2: Actualizar snapshot del trabajador para pasar `diasAlerta`**

Leer `app/api/trabajador/snapshot/route.ts`. Encontrar dónde llama a `calcularResumen`. Agregar lectura de config y pasar el valor:

```typescript
import { obtenerConfiguracion } from '@/lib/configuracion';

// Al inicio del handler, junto a las otras queries:
const config = await obtenerConfiguracion();

// Luego en cada llamada a calcularResumen, pasar el 4° arg:
calcularResumen(ultimaCompletada, frecuenciaDias, ahora, config.alerta_dias_anticipacion);
```

**Nota:** Solo actualizar el snapshot del trabajador en este task. Si hay otros snapshots (jefe, bodega) que también usan `calcularResumen`, aplica el mismo patrón en los mismos archivos.

- [ ] **Step 3: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 4: Commit**

```powershell
git add lib/fechas-tarea.ts app/api/trabajador/snapshot/route.ts
git commit -m "feat: alerta_dias_anticipacion configurable desde configuracion_finca"
```

---

## Task 9: Consumir `insumo_stock_minimo_default` en formulario de insumo

**Files:**

- Modify: `app/(app)/bodega/inventario/insumos/_formulario.tsx`
- Posiblemente modify: la page.tsx que renderiza ese formulario para insumos nuevos

- [ ] **Step 1: Leer el formulario de insumos**

Leer `app/(app)/bodega/inventario/insumos/_formulario.tsx`. El campo `stock_minimo` tiene `defaultValue={valores?.stock_minimo ?? "0"}`.

- [ ] **Step 2: Encontrar la page que renderiza el formulario para creación**

Buscar en `app/(app)/bodega/inventario/insumos/` si hay un `nuevo/page.tsx` o similar que renderice `_formulario.tsx`.

- [ ] **Step 3: Agregar prop `stockMinimoDefault` al formulario**

En `_formulario.tsx`, agregar `stockMinimoDefault?: number` a la interfaz de Props:

```typescript
// En el defaultValue del campo stock_minimo:
defaultValue={valores?.stock_minimo ?? (stockMinimoDefault != null ? String(stockMinimoDefault) : "0")}
```

- [ ] **Step 4: En la page de nuevo insumo, leer config y pasar prop**

En la page que renderiza el formulario para **crear** un insumo nuevo (no editar):

```typescript
import { obtenerConfiguracion } from '@/lib/configuracion';

const config = await obtenerConfiguracion();

// En el JSX:
<FormularioInsumo stockMinimoDefault={Number(config.insumo_stock_minimo_default)} />;
```

Para la page de **editar** insumo, no pasar la prop (usa el valor del registro existente).

- [ ] **Step 5: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 6: Commit**

```powershell
git add "app/(app)/bodega/inventario/insumos/_formulario.tsx"
git commit -m "feat: pre-rellenar stock_minimo desde configuracion al crear insumo"
```

---

## Task 10: Consumir defaults financieros en formulario de nuevo trabajador

**Files:**

- Modify: `app/(app)/jefe/equipo/nuevo/page.tsx`
- Modify: `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`

- [ ] **Step 1: Leer ambos archivos**

Leer `app/(app)/jefe/equipo/nuevo/page.tsx` y `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`.

- [ ] **Step 2: Modificar `page.tsx` para leer config y pasarla**

```typescript
import { obtenerConfiguracion } from '@/lib/configuracion';

// En el body del Server Component:
const config = await obtenerConfiguracion();

// En el JSX:
<FormularioNuevoMiembro
  // ...props existentes...
  jornalTarifaDefault={
    config.jornal_tarifa_default != null ? Number(config.jornal_tarifa_default) : null
  }
  fijoSalarioDefault={
    config.fijo_salario_default != null ? Number(config.fijo_salario_default) : null
  }
  fijoPeriodoPagoDefault={config.fijo_periodo_pago_default ?? null}
/>;
```

- [ ] **Step 3: Modificar `FormularioNuevoMiembro.tsx` para aceptar y usar las props**

Agregar a la interfaz de Props:

```typescript
jornalTarifaDefault: number | null;
fijoSalarioDefault: number | null;
fijoPeriodoPagoDefault: TipoPeriodoPago | null;
```

Importar `formatearMiles` desde `@/lib/formatos` si no está importado ya.

En el campo de `tarifa_jornal` (visible cuando `tipoVinculacion === "JORNALERO"`), cambiar el `placeholder` o `defaultValue`:

```tsx
defaultValue={jornalTarifaDefault != null ? formatearMiles(jornalTarifaDefault) : ''}
placeholder={jornalTarifaDefault != null ? formatearMiles(jornalTarifaDefault) : 'Ej. 50.000'}
```

En el campo de `salario_base` (visible cuando `tipoVinculacion === "FIJO"`):

```tsx
defaultValue={fijoSalarioDefault != null ? formatearMiles(fijoSalarioDefault) : ''}
```

En el select `periodo_pago`:

```tsx
defaultValue={fijoPeriodoPagoDefault ?? 'QUINCENAL'}
```

- [ ] **Step 4: Verificar tipos**

```powershell
npm run check:types
```

- [ ] **Step 5: Commit**

```powershell
git add "app/(app)/jefe/equipo/nuevo/page.tsx" "app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx"
git commit -m "feat: pre-rellenar campos financieros en nuevo trabajador desde configuracion"
```

---

## Verificación final

- [ ] **Correr migración en Supabase**

Abrir Supabase → SQL Editor → pegar y ejecutar `supabase/migracion-configuracion-finca.sql`.

- [ ] **Verificar tipos completos**

```powershell
npm run check:types
```

Debe pasar sin errores.

- [ ] **Verificar en dev**

```powershell
npm run dev
```

Probar:

1. Ir a `/jefe` → ver atajo "Configuración"
2. Ir a `/jefe/configuracion` → ver formulario con 4 secciones y valores iniciales
3. Cambiar capacidad de canasta a `25` → guardar → ir a `/almacen/cosecha/nueva` → verificar que el campo de capacidad tiene `25` pre-llenado
4. Cambiar días anticipación a `14` → guardar → verificar que las alertas de tarea usan 14 días

---

## Notas para el implementador

- `despacho_hora_corte` se guarda pero **no se conecta a ninguna lógica automática** en esta iteración. Solo se almacena para uso futuro.
- `finca_nombre`, `finca_telefono`, `finca_correo` se guardan pero **no se muestran en ninguna UI** todavía. Reservados para reportes PDF.
- Si `obtenerConfiguracion()` lanza error en producción ("Fila no encontrada"), significa que la migración no se corrió. Correr `supabase/migracion-configuracion-finca.sql`.
- El `_formulario.tsx` de cosecha es un **Client Component** (`'use client'`). El `useState` solo puede inicializarse con el valor de `canastaPorDefecto` como valor inicial; no puede reaccionar a cambios de prop después del primer render. Esto es correcto — el default pre-rellena pero el usuario puede cambiar el valor.
