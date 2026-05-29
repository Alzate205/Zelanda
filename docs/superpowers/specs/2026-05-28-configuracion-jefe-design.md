# Configuración del Jefe — Design Spec

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Panel unificado `/jefe/configuracion` donde el JEFE puede preconfigurar parámetros operativos, financieros y de alertas de la finca.

**Architecture:** Tabla `configuracion_finca` con una sola fila y columnas tipadas. Server Component lee la fila y renderiza un formulario con secciones. Server Action hace upsert. Los valores se consumen en los formularios y lógica donde hoy hay valores hardcodeados.

**Tech Stack:** Next.js 15 App Router, Prisma, PostgreSQL (Supabase), Server Actions, Tailwind CSS, Lucide React.

---

## Base de datos

### Tabla `configuracion_finca`

```sql
CREATE TABLE configuracion_finca (
  id                           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Cosecha
  canasta_kg_default           NUMERIC(8,2)  NOT NULL DEFAULT 23,

  -- Alertas y tareas
  alerta_dias_anticipacion     INT           NOT NULL DEFAULT 7,

  -- Bodega
  despacho_hora_corte          TIME          NOT NULL DEFAULT '17:00',
  insumo_stock_minimo_default  NUMERIC(10,3) NOT NULL DEFAULT 0,

  -- Financiero (nullable: solo pre-llenan, no son obligatorios)
  jornal_tarifa_default        NUMERIC(12,2),
  fijo_salario_default         NUMERIC(12,2),
  fijo_periodo_pago_default    tipo_periodo_pago,  -- enum existente: MENSUAL | QUINCENAL | SEMANAL

  -- Datos de la finca (para reportes futuros)
  finca_nombre                 TEXT          NOT NULL DEFAULT 'Hacienda La Zelanda',
  finca_telefono               TEXT,
  finca_correo                 TEXT,

  -- Auditoría
  updated_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by                   UUID          REFERENCES auth.users(id)
);

-- Garantizar siempre una fila
INSERT INTO configuracion_finca DEFAULT VALUES ON CONFLICT DO NOTHING;
```

### RLS

```sql
-- Solo JEFE puede leer y modificar
CREATE POLICY "jefe_lee_config" ON configuracion_finca
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );

CREATE POLICY "jefe_modifica_config" ON configuracion_finca
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );
```

---

## Modelo Prisma

```prisma
model configuracion_finca {
  id                          Int       @id @default(1)
  canasta_kg_default          Decimal   @db.Decimal(8, 2)
  alerta_dias_anticipacion    Int
  despacho_hora_corte         DateTime  @db.Time
  insumo_stock_minimo_default Decimal   @db.Decimal(10, 3)
  jornal_tarifa_default       Decimal?  @db.Decimal(12, 2)
  fijo_salario_default        Decimal?  @db.Decimal(12, 2)
  fijo_periodo_pago_default   TipoPeriodoPago?
  finca_nombre                String
  finca_telefono              String?
  finca_correo                String?
  updated_at                  DateTime  @default(now()) @db.Timestamptz
  updated_by                  String?   @db.Uuid
  updated_by_u                usuarios? @relation(fields: [updated_by], references: [id])
}
```

---

## Función helper: `lib/configuracion.ts`

```typescript
import { prisma } from './prisma';

export async function obtenerConfiguracion() {
  const config = await prisma.configuracion_finca.findUnique({ where: { id: 1 } });
  if (!config) throw new Error('configuracion_finca row missing');
  return config;
}
```

Esta función se usa en los Server Components que necesiten los valores de configuración.

---

## Página `/jefe/configuracion`

### Estructura de archivos

- `app/(app)/jefe/configuracion/page.tsx` — Server Component, lee config y renderiza formulario
- `app/(app)/jefe/configuracion/FormularioConfiguracion.tsx` — Client Component con el formulario
- `app/(app)/jefe/configuracion/acciones.ts` — Server Action `guardarConfiguracion`

### UI: secciones con cards

La página tiene 4 secciones apiladas verticalmente, cada una en su card:

1. **Finca** — `finca_nombre`, `finca_telefono`, `finca_correo`
2. **Cosecha** — `canasta_kg_default` (con label "kg por canasta por defecto")
3. **Alertas y Bodega** — `alerta_dias_anticipacion`, `despacho_hora_corte`, `insumo_stock_minimo_default`
4. **Financiero** — `jornal_tarifa_default`, `fijo_salario_default`, `fijo_periodo_pago_default`

Un solo botón "Guardar cambios" al pie de la página. Usa `useFormState` / `useActionState` para mostrar errores.

### Server Action `guardarConfiguracion`

```typescript
export async function guardarConfiguracion(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }>;
```

Hace `prisma.configuracion_finca.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: { ...data } })`.

Valida:

- `canasta_kg_default` > 0
- `alerta_dias_anticipacion` entre 1 y 60
- `insumo_stock_minimo_default` >= 0
- `jornal_tarifa_default` y `fijo_salario_default` si presentes > 0
- `finca_nombre` no vacío

---

## Consumo de configuración en otros módulos

### 1. `canasta_kg_default` → formulario de cosecha nueva

**Archivo:** `app/(app)/almacen/cosecha/nueva/_formulario.tsx`

El campo "capacidad por canasta" se pre-llena con `canasta_kg_default` desde la config. Hoy el usuario lo escribe a mano.

**Cómo:** La page.tsx que renderiza el formulario pasa el valor como prop `canastaPorDefecto`.

### 2. `alerta_dias_anticipacion` → lógica de alertas

**Archivo:** `lib/fechas-tarea.ts` línea 33: `else if (dias <= 7) estado = "proxima";`

Hoy tiene `7` hardcodeado. Reemplazar por `config.alerta_dias_anticipacion`.

### 3. `insumo_stock_minimo_default` → formulario de nuevo insumo

**Archivos:** `app/(app)/jefe/inventario/` o `app/(app)/bodega/` (donde se crea un insumo nuevo)

Pre-llena el campo `stock_minimo` con el valor de config.

### 4. `jornal_tarifa_default` / `fijo_salario_default` / `fijo_periodo_pago_default` → formulario de nuevo trabajador

**Archivo:** `app/(app)/jefe/equipo/nuevo/` (o equivalente)

Pre-llena campos financieros al crear trabajador JORNALERO o FIJO.

### 5. `despacho_hora_corte` → alerta de despachos abiertos

La alerta existente de "despacho abierto al final del día" usa esta hora en lugar de un valor hardcodeado. (Este consumo es para fase futura si la alerta ya no está implementada con hora configurable; si no existe la alerta, se guarda el valor para cuando se implemente.)

---

## Acceso desde dashboard

Agregar atajo "Configuración" en `/jefe/page.tsx` (dashboard del jefe), junto a los atajos existentes de Compras, Proveedores, etc.

---

## Migraciones

Archivo: `supabase/migracion-configuracion-finca.sql`

Contiene:

1. `CREATE TABLE configuracion_finca`
2. `INSERT INTO configuracion_finca DEFAULT VALUES ON CONFLICT DO NOTHING`
3. `ALTER TABLE configuracion_finca ENABLE ROW LEVEL SECURITY`
4. Las dos políticas RLS

---

## Fuera de scope

- La hora de corte de despachos (`despacho_hora_corte`) se guarda pero no se conecta a ninguna lógica de alerta automática en esta iteración (las alertas push de despachos abiertos no existen aún como cron).
- Los datos de `finca_nombre` / `finca_telefono` / `finca_correo` se guardan pero no se muestran en ninguna UI todavía (reservados para reportes PDF futuros).
- No hay historial de cambios de configuración (no se audita qué valor tenía antes del cambio).
