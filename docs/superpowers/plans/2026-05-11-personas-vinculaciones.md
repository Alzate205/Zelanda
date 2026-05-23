# Personas y Vínculos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la tabla `trabajadores` por un modelo `personas` + `vinculaciones` con histórico, soportando los 4 perfiles (FIJO, JORNALERO, CONTRATISTA, FAMILIAR), sin todavía tocar la capa financiera.

**Architecture:** Una migración SQL atómica reemplaza la tabla `trabajadores` por dos: `personas` (identidad invariante) y `vinculaciones` (cada "spell" de relación con la finca, con histórico). Las 6 tablas que referenciaban `trabajador_id` renombran la columna a `persona_id` apuntando a `personas(id)`. La función RLS `trabajador_id_actual()` se reemplaza por `persona_id_actual()`. El refactor de código TypeScript ajusta tipos, server actions y pantallas de `/jefe/equipo`.

**Tech Stack:** PostgreSQL 15 + PostGIS (Supabase), Prisma 6.19, Next.js 15 (App Router), React 19, TypeScript 5, Tailwind v3, Lucide React.

**Spec:** `docs/superpowers/specs/2026-05-11-personas-vinculaciones-design.md`
**Decisiones pendientes:** `docs/decisiones-pendientes.md` (D-006, D-007, D-009, D-012 aplican al núcleo)

---

## File Structure

### Archivos a crear

| Archivo | Responsabilidad |
|---|---|
| `supabase/migracion-nucleo-personas.sql` | SQL idempotente: enums, tablas, migración de datos, renombres, RLS |
| `scripts/verificar-migracion-nucleo.mjs` | Script Node que consulta la BD post-migración y reporta estado |
| `app/(app)/jefe/equipo/[id]/page.tsx` | Detalle de persona + histórico de vinculaciones |
| `app/(app)/jefe/equipo/[id]/editar/page.tsx` | Server Component que renderea el formulario de edición |
| `app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx` | Client Component: edición de persona + cierre/apertura de vinculación |
| `app/(app)/jefe/equipo/[id]/acciones.ts` | Server actions: actualizarPersona, cambiarVinculacion |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar enums + modelos personas/vinculaciones, renombrar trabajador_id → persona_id en 6 modelos, eliminar modelo trabajadores |
| `supabase/policies.sql` | Reemplazar `trabajador_id_actual()` por `persona_id_actual()`; agregar policies para personas y vinculaciones |
| `types/index.ts` | Agregar `TipoVinculacion`, `TipoPeriodoPago`, `EsquemaPagoDestajo` |
| `lib/auth.ts` | `UsuarioActual.trabajador_id` → `persona_id` |
| `lib/constantes.ts` | Agregar `ETIQUETA_TIPO_VINCULACION` |
| `scripts/crear-primer-jefe.mjs` | Crear `persona` + `vinculacion` tipo `FAMILIAR` en vez de trabajador |
| `app/(app)/jefe/equipo/page.tsx` | Mostrar tipo de vinculación + link a detalle |
| `app/(app)/jefe/equipo/acciones.ts` | `crearMiembro` ahora crea persona + vinculación |
| `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx` | Selector de tipo de vinculación + campos condicionales |
| `CLAUDE.md` | Actualizar §4.4, §5.5, §5.6, §6 |

---

## Pre-flight

Antes de empezar, verificar que el árbol de trabajo está limpio y la app está funcionando.

- [ ] **Verificar working tree limpio**

Run: `git status --short`
Expected: vacío o solo cambios autorizados antes de comenzar.

- [ ] **Verificar build actual pasa**

Run: `npm run build`
Expected: `Compiled successfully` + lista de rutas. Si falla, parar y corregir antes de seguir.

---

## Task 1: Escribir el SQL de migración (sin ejecutar todavía)

**Files:**
- Create: `supabase/migracion-nucleo-personas.sql`

**Why:** Tener todo el SQL en un archivo revisable y versionable antes de ejecutarlo. Idempotente — si algo falla, se puede re-correr.

- [ ] **Step 1.1: Crear el archivo con el SQL completo**

Crear `supabase/migracion-nucleo-personas.sql` con:

```sql
-- ============================================================
-- Migración Núcleo Personas — 2026-05-11
-- Reemplaza `trabajadores` por `personas` + `vinculaciones`.
-- Spec: docs/superpowers/specs/2026-05-11-personas-vinculaciones-design.md
--
-- Idempotente: usa IF NOT EXISTS / IF EXISTS y verifica datos antes de mover.
-- Ejecutar en una sola transacción.
-- ============================================================

BEGIN;

-- =====================================================
-- 1. Desactivar RLS en tablas afectadas (durante migración)
-- =====================================================
ALTER TABLE public.trabajadores       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_avance   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas           DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Crear enums nuevos (si no existen)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE tipo_vinculacion AS ENUM ('FIJO', 'JORNALERO', 'CONTRATISTA', 'FAMILIAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_periodo_pago AS ENUM ('MENSUAL', 'QUINCENAL', 'SEMANAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE esquema_pago_destajo AS ENUM ('NUNCA', 'ADICIONAL', 'REEMPLAZA_DIA', 'SOLO_DESTAJO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 3. Tabla personas (identidad)
-- =====================================================
CREATE TABLE IF NOT EXISTS personas (
  id                BIGINT PRIMARY KEY,
  nombre_completo   TEXT NOT NULL,
  cedula            TEXT UNIQUE,
  telefono          TEXT,
  fecha_nacimiento  DATE,
  foto_path         TEXT,
  notas             TEXT,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- =====================================================
-- 4. Tabla vinculaciones (cada relación en el tiempo)
-- =====================================================
CREATE TABLE IF NOT EXISTS vinculaciones (
  id                      BIGSERIAL PRIMARY KEY,
  persona_id              BIGINT NOT NULL REFERENCES personas(id),
  tipo                    tipo_vinculacion NOT NULL,
  rol_finca               TEXT,
  fecha_inicio            DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin               DATE,
  salario_base            NUMERIC(12,2),
  periodo_pago            tipo_periodo_pago,
  tarifa_jornal           NUMERIC(12,2),
  esquema_pago_destajo    esquema_pago_destajo,
  notas                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_vinc_fechas
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),

  CONSTRAINT chk_vinc_campos_por_tipo CHECK (
    (tipo = 'FIJO'
       AND salario_base IS NOT NULL
       AND periodo_pago IS NOT NULL
       AND tarifa_jornal IS NULL)
    OR
    (tipo = 'JORNALERO'
       AND tarifa_jornal IS NOT NULL
       AND salario_base IS NULL
       AND periodo_pago IS NULL)
    OR
    (tipo IN ('CONTRATISTA','FAMILIAR')
       AND salario_base IS NULL
       AND tarifa_jornal IS NULL
       AND periodo_pago IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vinculaciones_persona ON vinculaciones(persona_id);

DROP INDEX IF EXISTS uq_vinculacion_activa;
CREATE UNIQUE INDEX uq_vinculacion_activa
  ON vinculaciones(persona_id) WHERE fecha_fin IS NULL;

-- =====================================================
-- 5. Migrar datos: trabajadores → personas (mismos IDs)
-- =====================================================
INSERT INTO personas (id, nombre_completo, cedula, telefono, notas, activo, created_at, updated_at, deleted_at)
SELECT id, nombre_completo, cedula, telefono, notas, activo, created_at, updated_at, deleted_at
FROM trabajadores
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. Crear vinculación inicial FAMILIAR para cada trabajador existente.
--    Razón: los datos actuales no permiten crear FIJO sin perder validación
--    (salario_base puede ser null). El jefe ajusta en la UI después.
--    Si en el futuro hay datos con salario_base válido, ese caso se trata
--    explícitamente, no en esta migración masiva.
-- =====================================================
INSERT INTO vinculaciones (persona_id, tipo, rol_finca, fecha_inicio, notas)
SELECT
  t.id,
  'FAMILIAR'::tipo_vinculacion,
  t.rol_finca,
  COALESCE(t.fecha_ingreso, CURRENT_DATE),
  CASE
    WHEN t.salario_base IS NOT NULL
      THEN 'Migrado de trabajadores. salario_base original (no migrado): ' || t.salario_base::text
    ELSE 'Migrado de trabajadores 2026-05-11.'
  END
FROM trabajadores t
WHERE NOT EXISTS (
  SELECT 1 FROM vinculaciones v WHERE v.persona_id = t.id
);

-- =====================================================
-- 7. Renombrar columna trabajador_id → persona_id en 6 tablas.
--    Los valores ya coinciden (mismo id). Las FKs se recrean apuntando a personas.
-- =====================================================

-- usuarios
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_trabajador_id_fkey;
ALTER TABLE public.usuarios RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);

-- asignaciones
ALTER TABLE public.asignaciones DROP CONSTRAINT IF EXISTS asignaciones_trabajador_id_fkey;
ALTER TABLE public.asignaciones RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.asignaciones
  ADD CONSTRAINT asignaciones_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);
DROP INDEX IF EXISTS idx_asign_trabajador_estado;
CREATE INDEX IF NOT EXISTS idx_asign_persona_estado ON asignaciones(persona_id, estado);

-- registros_avance
ALTER TABLE public.registros_avance DROP CONSTRAINT IF EXISTS registros_avance_trabajador_id_fkey;
ALTER TABLE public.registros_avance RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.registros_avance
  ADD CONSTRAINT registros_avance_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);

-- novedades
ALTER TABLE public.novedades DROP CONSTRAINT IF EXISTS novedades_trabajador_id_fkey;
ALTER TABLE public.novedades RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.novedades
  ADD CONSTRAINT novedades_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);

-- despachos
ALTER TABLE public.despachos DROP CONSTRAINT IF EXISTS despachos_trabajador_id_fkey;
ALTER TABLE public.despachos RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.despachos
  ADD CONSTRAINT despachos_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);
DROP INDEX IF EXISTS idx_despachos_trabajador_estado;
CREATE INDEX IF NOT EXISTS idx_despachos_persona_estado ON despachos(persona_id, estado);

-- cosechas
ALTER TABLE public.cosechas DROP CONSTRAINT IF EXISTS cosechas_trabajador_id_fkey;
ALTER TABLE public.cosechas RENAME COLUMN trabajador_id TO persona_id;
ALTER TABLE public.cosechas
  ADD CONSTRAINT cosechas_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);

-- =====================================================
-- 8. Drop tabla trabajadores
-- =====================================================
DROP TABLE IF EXISTS trabajadores CASCADE;

-- =====================================================
-- 9. Actualizar funciones de RLS
-- =====================================================
DROP FUNCTION IF EXISTS public.trabajador_id_actual() CASCADE;

CREATE OR REPLACE FUNCTION public.persona_id_actual()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT persona_id FROM public.usuarios WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.persona_id_actual() TO authenticated;

-- =====================================================
-- 10. Triggers de updated_at para tablas nuevas
-- =====================================================
DROP TRIGGER IF EXISTS trg_upd_personas ON personas;
CREATE TRIGGER trg_upd_personas BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_upd_vinculaciones ON vinculaciones;
CREATE TRIGGER trg_upd_vinculaciones BEFORE UPDATE ON vinculaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- 11. RLS en tablas nuevas (políticas se cargan después desde supabase/policies.sql)
-- =====================================================
ALTER TABLE public.personas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculaciones  ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12. Reactivar RLS en tablas que se pausaron
-- =====================================================
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_avance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas           ENABLE ROW LEVEL SECURITY;

COMMIT;
```

- [ ] **Step 1.2: Verificar que el archivo se creó correctamente**

Run: `Get-Item supabase/migracion-nucleo-personas.sql | Select-Object Name, Length`
Expected: archivo existe con tamaño > 5000 bytes.

- [ ] **Step 1.3: Commit del archivo SQL (todavía sin ejecutar)**

```bash
git add supabase/migracion-nucleo-personas.sql
git commit -m "feat(migracion): script SQL para migrar trabajadores a personas + vinculaciones

Idempotente. Crea personas y vinculaciones, migra datos preservando IDs,
renombra trabajador_id → persona_id en 6 tablas, recrea FKs, dropa
trabajadores, actualiza función RLS persona_id_actual().
No ejecutado todavía."
```

---

## Task 2: Crear script de verificación post-migración

**Files:**
- Create: `scripts/verificar-migracion-nucleo.mjs`

**Why:** Script Node que consulta la BD vía Prisma y reporta el estado. Sirve antes y después de ejecutar la migración para comparar.

- [ ] **Step 2.1: Crear el script**

```javascript
/**
 * Verificación de migración núcleo personas.
 * Reporta:
 *  - Tablas existentes en public schema
 *  - Conteos clave (trabajadores, personas, vinculaciones, usuarios)
 *  - Existencia de funciones RLS
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/verificar-migracion-nucleo.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ok(label, val) { console.log(`  ✓ ${label}: ${val}`); }
function warn(label, msg) { console.log(`  ⚠ ${label}: ${msg}`); }

try {
  console.log("--- Tablas en public ---");
  const tablas = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const nombres = tablas.map((t) => t.table_name);
  ok("Total tablas", nombres.length);
  console.log("    " + nombres.join(", "));

  const tieneTrabajadores = nombres.includes("trabajadores");
  const tienePersonas = nombres.includes("personas");
  const tieneVinculaciones = nombres.includes("vinculaciones");

  console.log("\n--- Estado de migración ---");
  if (tieneTrabajadores && !tienePersonas) {
    warn("Estado", "Pre-migración (trabajadores existe, personas no)");
  } else if (!tieneTrabajadores && tienePersonas) {
    ok("Estado", "Post-migración (trabajadores eliminado, personas creada)");
  } else if (tieneTrabajadores && tienePersonas) {
    warn("Estado", "Migración INCOMPLETA (ambas tablas existen)");
  } else {
    warn("Estado", "Inconsistente (ninguna tabla de persona)");
  }

  console.log("\n--- Conteos ---");
  if (tieneTrabajadores) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM trabajadores`);
    ok("trabajadores rows", c[0].n);
  }
  if (tienePersonas) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM personas`);
    ok("personas rows", c[0].n);
  }
  if (tieneVinculaciones) {
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM vinculaciones`);
    ok("vinculaciones rows", c[0].n);
    const tipos = await prisma.$queryRawUnsafe(`
      SELECT tipo::text, COUNT(*)::int AS n FROM vinculaciones GROUP BY tipo
    `);
    for (const r of tipos) ok(`  vinculaciones tipo=${r.tipo}`, r.n);
  }
  const cUsuarios = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM usuarios`);
  ok("usuarios rows", cUsuarios[0].n);

  console.log("\n--- Columnas FK ---");
  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('trabajador_id', 'persona_id')
    ORDER BY table_name, column_name
  `);
  for (const c of cols) ok(`${c.table_name}.${c.column_name}`, "exists");

  console.log("\n--- Funciones RLS ---");
  const fns = await prisma.$queryRawUnsafe(`
    SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND proname IN ('trabajador_id_actual', 'persona_id_actual')
  `);
  const haytrab = fns.some((f) => f.proname === "trabajador_id_actual");
  const haypers = fns.some((f) => f.proname === "persona_id_actual");
  if (haytrab) warn("trabajador_id_actual", "todavía existe");
  if (haypers) ok("persona_id_actual", "existe");
  if (!haytrab && !haypers) warn("Funciones RLS", "ninguna existe");

  console.log("\n--- Enums ---");
  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typtype = 'e' AND typname IN
      ('tipo_vinculacion', 'tipo_periodo_pago', 'esquema_pago_destajo')
    ORDER BY typname
  `);
  for (const e of enums) ok(`enum ${e.typname}`, "existe");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
```

- [ ] **Step 2.2: Agregar script al package.json**

Modificar `package.json` en la sección `"scripts"`:

```json
"verificar:migracion": "node --env-file=.env --env-file=.env.local scripts/verificar-migracion-nucleo.mjs"
```

- [ ] **Step 2.3: Correr el script (estado pre-migración)**

Run: `npm run verificar:migracion`
Expected:
- "Estado: Pre-migración (trabajadores existe, personas no)"
- trabajadores rows = 1 (el jefe)
- Columnas: `*.trabajador_id` existen, no `persona_id`
- Función `trabajador_id_actual` existe; `persona_id_actual` no
- Enums: ninguno todavía

- [ ] **Step 2.4: Commit del script de verificación**

```bash
git add scripts/verificar-migracion-nucleo.mjs package.json
git commit -m "feat(migracion): script verificar-migracion-nucleo

Consulta la BD y reporta estado pre/post migración: tablas, conteos,
columnas FK, funciones RLS, enums."
```

---

## Task 3: Ejecutar la migración SQL en la BD

**Files:**
- (ninguno modificado en código; cambia la BD)

**Why:** Aplicar el SQL del Task 1 a la base real. Single SQL command via `prisma db execute`.

- [ ] **Step 3.1: Ejecutar la migración**

Run: `npx prisma db execute --file supabase/migracion-nucleo-personas.sql --schema prisma/schema.prisma`
Expected: `Script executed successfully.` (sin errores).

Si falla con error de PG, leer el mensaje, corregir el SQL en `supabase/migracion-nucleo-personas.sql`, commitear el fix, re-ejecutar. La migración es idempotente, se puede re-correr.

- [ ] **Step 3.2: Correr verificación**

Run: `npm run verificar:migracion`
Expected:
- "Estado: Post-migración (trabajadores eliminado, personas creada)"
- personas rows = 1
- vinculaciones rows = 1 (FAMILIAR)
- Columnas: `*.persona_id` existen, no `trabajador_id`
- Función `persona_id_actual` existe; `trabajador_id_actual` no
- Enums: los 3 existen

Si algo no coincide, debugear con queries SQL ad-hoc antes de continuar.

---

## Task 4: Actualizar Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Why:** Sincronizar el schema de Prisma con el estado real de la BD para que el cliente generado refleje los nuevos modelos.

- [ ] **Step 4.1: Reemplazar el contenido del schema**

Abrir `prisma/schema.prisma` y aplicar estos cambios concretos:

A) **Agregar los 3 enums nuevos** después del enum `TipoMovimiento`:

```prisma
enum TipoVinculacion {
  FIJO
  JORNALERO
  CONTRATISTA
  FAMILIAR

  @@map("tipo_vinculacion")
}

enum TipoPeriodoPago {
  MENSUAL
  QUINCENAL
  SEMANAL

  @@map("tipo_periodo_pago")
}

enum EsquemaPagoDestajo {
  NUNCA
  ADICIONAL
  REEMPLAZA_DIA
  SOLO_DESTAJO

  @@map("esquema_pago_destajo")
}
```

B) **Eliminar el modelo `trabajadores` completo** (líneas que empiezan con `model trabajadores {` hasta su llave de cierre).

C) **Agregar los modelos `personas` y `vinculaciones`** donde estaba `trabajadores`:

```prisma
model personas {
  id                BigInt    @id
  nombre_completo   String
  cedula            String?   @unique
  telefono          String?
  fecha_nacimiento  DateTime? @db.Date
  foto_path         String?
  notas             String?
  activo            Boolean   @default(true)
  created_at        DateTime  @default(now()) @db.Timestamptz(6)
  updated_at        DateTime  @default(now()) @db.Timestamptz(6)
  deleted_at        DateTime? @db.Timestamptz(6)

  usuarios          usuarios[]
  vinculaciones     vinculaciones[]
  asignaciones      asignaciones[]
  registros_avance  registros_avance[]
  novedades         novedades[]
  despachos         despachos[]
  cosechas          cosechas[]
}

model vinculaciones {
  id                      BigInt              @id @default(autoincrement())
  persona_id              BigInt
  tipo                    TipoVinculacion
  rol_finca               String?
  fecha_inicio            DateTime            @default(now()) @db.Date
  fecha_fin               DateTime?           @db.Date
  salario_base            Decimal?            @db.Decimal(12, 2)
  periodo_pago            TipoPeriodoPago?
  tarifa_jornal           Decimal?            @db.Decimal(12, 2)
  esquema_pago_destajo    EsquemaPagoDestajo?
  notas                   String?
  created_at              DateTime            @default(now()) @db.Timestamptz(6)
  updated_at              DateTime            @default(now()) @db.Timestamptz(6)

  persona                 personas            @relation(fields: [persona_id], references: [id])

  @@index([persona_id])
}
```

D) **Renombrar `trabajador_id` → `persona_id` y la relación `trabajador` → `persona`** en estos 6 modelos:

En `usuarios`:
- `trabajador_id BigInt?` → `persona_id BigInt?`
- `trabajador trabajadores? @relation(fields: [trabajador_id], references: [id])` → `persona personas? @relation(fields: [persona_id], references: [id])`

En `asignaciones`:
- `trabajador_id BigInt` → `persona_id BigInt`
- `trabajador trabajadores @relation(fields: [trabajador_id], references: [id])` → `persona personas @relation(fields: [persona_id], references: [id])`
- `@@index([trabajador_id, estado])` → `@@index([persona_id, estado])`

En `registros_avance`:
- `trabajador_id BigInt` → `persona_id BigInt`
- `trabajador trabajadores @relation(fields: [trabajador_id], references: [id])` → `persona personas @relation(fields: [persona_id], references: [id])`

En `novedades`:
- `trabajador_id BigInt` → `persona_id BigInt`
- `trabajador trabajadores @relation(fields: [trabajador_id], references: [id])` → `persona personas @relation(fields: [persona_id], references: [id])`

En `despachos`:
- `trabajador_id BigInt` → `persona_id BigInt`
- `trabajador trabajadores @relation(fields: [trabajador_id], references: [id])` → `persona personas @relation(fields: [persona_id], references: [id])`
- `@@index([trabajador_id, estado])` → `@@index([persona_id, estado])`

En `cosechas`:
- `trabajador_id BigInt` → `persona_id BigInt`
- `trabajador trabajadores @relation(fields: [trabajador_id], references: [id])` → `persona personas @relation(fields: [persona_id], references: [id])`

- [ ] **Step 4.2: Formatear y validar el schema**

Run: `npx prisma format`
Expected: `Formatted prisma\schema.prisma`.

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`.

Si hay error de validación: leer el mensaje y arreglar la sintaxis del schema. Errores comunes: nombre de relación duplicado, referencia a modelo que no existe.

- [ ] **Step 4.3: Generar cliente Prisma**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (v6.19.3) to .\node_modules\@prisma\client`.

- [ ] **Step 4.4: Verificar que el schema escrito coincide con la BD**

Run: `npx prisma db pull --print` y comparar el output con `prisma/schema.prisma`.
Expected: los modelos `personas`, `vinculaciones`, y las columnas `persona_id` en las 6 tablas coinciden. (Algunas diferencias menores de orden o whitespace son OK.)

Si hay discrepancias estructurales (faltan columnas, tipos distintos), corregir `prisma/schema.prisma` y volver a Step 4.2.

- [ ] **Step 4.5: Commit del schema**

```bash
git add prisma/schema.prisma
git commit -m "feat(prisma): personas + vinculaciones; trabajador_id → persona_id

Refleja la migración de DB. Agrega 3 enums (TipoVinculacion, TipoPeriodoPago,
EsquemaPagoDestajo), 2 modelos (personas, vinculaciones), elimina modelo
trabajadores, renombra trabajador_id → persona_id y la relación trabajador
→ persona en usuarios, asignaciones, registros_avance, novedades, despachos,
cosechas."
```

---

## Task 5: Actualizar `types/index.ts`

**Files:**
- Modify: `types/index.ts`

**Why:** El código de UI y server actions necesita tipos TS para los nuevos enums.

- [ ] **Step 5.1: Editar el archivo**

Agregar al final del archivo (antes de `RespuestaApi`):

```typescript
export type TipoVinculacion =
  | "FIJO"
  | "JORNALERO"
  | "CONTRATISTA"
  | "FAMILIAR";

export type TipoPeriodoPago = "MENSUAL" | "QUINCENAL" | "SEMANAL";

export type EsquemaPagoDestajo =
  | "NUNCA"
  | "ADICIONAL"
  | "REEMPLAZA_DIA"
  | "SOLO_DESTAJO";
```

- [ ] **Step 5.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: típicamente fallará con errores en otros archivos que usan `trabajador_id`. Anotar los errores; los iremos arreglando uno a uno.

- [ ] **Step 5.3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): agregar TipoVinculacion, TipoPeriodoPago, EsquemaPagoDestajo"
```

---

## Task 6: Actualizar `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`

**Why:** `UsuarioActual` tiene la propiedad `trabajador_id` que ya no existe en la columna de BD. Renombrar a `persona_id`.

- [ ] **Step 6.1: Editar el archivo**

En `lib/auth.ts`:

A) En el `type UsuarioActual`, cambiar:
```typescript
trabajador_id: number | null;
```
por:
```typescript
persona_id: number | null;
```

B) En la query de `obtenerUsuarioActual`, cambiar el select:
```typescript
.select("id, email, nombre_completo, rol, trabajador_id, activo")
```
por:
```typescript
.select("id, email, nombre_completo, rol, persona_id, activo")
```

- [ ] **Step 6.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: el error específico de `lib/auth.ts` debe desaparecer. Otros errores en otros archivos siguen.

- [ ] **Step 6.3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): UsuarioActual.trabajador_id → persona_id"
```

---

## Task 7: Actualizar `lib/constantes.ts`

**Files:**
- Modify: `lib/constantes.ts`

**Why:** Necesitamos un mapa de etiquetas para los nuevos tipos de vinculación (para mostrar "Fijo" en vez de "FIJO" en UI).

- [ ] **Step 7.1: Editar el archivo**

Agregar al final de `lib/constantes.ts`:

```typescript
import type { TipoVinculacion } from "@/types";

export const ETIQUETA_TIPO_VINCULACION: Record<TipoVinculacion, string> = {
  FIJO: "Fijo",
  JORNALERO: "Jornalero",
  CONTRATISTA: "Contratista",
  FAMILIAR: "Familia",
};
```

Nota: ya existe un `import type { RolUsuario } from "@/types";` arriba. Consolidar:

```typescript
import type { RolUsuario, TipoVinculacion } from "@/types";
```

(Reemplaza el import existente; no duplicar la línea.)

- [ ] **Step 7.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: el archivo compila; otros errores en otros archivos siguen.

- [ ] **Step 7.3: Commit**

```bash
git add lib/constantes.ts
git commit -m "feat(constantes): agregar ETIQUETA_TIPO_VINCULACION"
```

---

## Task 8: Actualizar `scripts/crear-primer-jefe.mjs`

**Files:**
- Modify: `scripts/crear-primer-jefe.mjs`

**Why:** El script todavía referencia `trabajadores`. Reescribir para crear `personas` + `vinculaciones` tipo `FAMILIAR`.

- [ ] **Step 8.1: Editar el archivo**

Reemplazar la sección que crea/encuentra el trabajador (desde el comentario `// 2) Asegurar fila en \`trabajadores\``) por:

```javascript
  // 2) Asegurar fila en `personas`.
  let persona = await prisma.personas.findFirst({
    where: { nombre_completo: nombre },
  });
  if (!persona) {
    // El id de personas es BIGINT manual (no autoincrement). Usamos el siguiente
    // disponible vía SELECT MAX + 1 (suficiente para el alta del primer jefe;
    // en flujos normales se usa BIGSERIAL en la tabla personas — pero aquí el
    // schema usa @id sin @default(autoincrement) porque copiamos IDs de trabajadores
    // durante la migración).
    const filas = await prisma.$queryRaw`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas`;
    const nextId = filas[0].next_id;
    persona = await prisma.personas.create({
      data: {
        id: nextId,
        nombre_completo: nombre,
        activo: true,
      },
    });
    console.log("✓  Persona creada: id =", Number(persona.id));
  } else {
    console.log("·  Persona ya existía: id =", Number(persona.id));
  }

  // Asegurar vinculación FAMILIAR activa para el jefe.
  const vinculacionActiva = await prisma.vinculaciones.findFirst({
    where: { persona_id: persona.id, fecha_fin: null },
  });
  if (!vinculacionActiva) {
    await prisma.vinculaciones.create({
      data: {
        persona_id: persona.id,
        tipo: "FAMILIAR",
        rol_finca: "Jefe de finca",
        notas: "Alta inicial del primer jefe.",
      },
    });
    console.log("✓  Vinculación FAMILIAR creada para la persona.");
  } else {
    console.log("·  Persona ya tiene vinculación activa, no se crea nueva.");
  }
```

Y reemplazar la sección que enlaza `usuarios.trabajador_id` por `usuarios.persona_id`:

En la creación/actualización de `usuarios`, cambiar:
```javascript
trabajador_id: trabajador.id,
```
por:
```javascript
persona_id: persona.id,
```

(Hay dos lugares: en `prisma.usuarios.update` y `prisma.usuarios.create`.)

- [ ] **Step 8.2: Verificar el script compila como módulo (no es TS, pero verificamos sintaxis)**

Run: `node --check scripts/crear-primer-jefe.mjs`
Expected: sin output (significa sintaxis OK).

- [ ] **Step 8.3: Commit**

```bash
git add scripts/crear-primer-jefe.mjs
git commit -m "feat(script): crear-primer-jefe usa personas + vinculaciones

Reemplaza la creación del trabajador por persona + vinculación FAMILIAR.
Enlaza usuarios.persona_id en lugar de usuarios.trabajador_id."
```

---

## Task 9: Actualizar server action `acciones.ts` de equipo

**Files:**
- Modify: `app/(app)/jefe/equipo/acciones.ts`

**Why:** `crearMiembro` crea un `trabajador` y lo enlaza al `usuarios`. Reemplazar por `personas` + `vinculaciones`. El formulario también debe pasar tipo de vinculación + sus campos.

- [ ] **Step 9.1: Sustituir el contenido completo del archivo**

Sobrescribir `app/(app)/jefe/equipo/acciones.ts` con:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/admin";
import type { RolUsuario, TipoVinculacion, TipoPeriodoPago } from "@/types";

export type EstadoFormulario = {
  error: string | null;
  exito: string | null;
};

const ESTADO_INICIAL: EstadoFormulario = { error: null, exito: null };

function esRolValido(v: string): v is RolUsuario {
  return v === "JEFE" || v === "BODEGA" || v === "ALMACEN" || v === "TRABAJADOR";
}

function esTipoVinculacionValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}

function esPeriodoPagoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}

export async function crearMiembro(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirUsuario("JEFE");

  // --- Datos persona ---
  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  // --- Datos vinculación ---
  const tipoVinculacionRaw = String(formData.get("tipo_vinculacion") ?? "");
  const rol_finca = String(formData.get("rol_finca") ?? "").trim();
  const salarioRaw = String(formData.get("salario_base") ?? "").trim();
  const periodoPagoRaw = String(formData.get("periodo_pago") ?? "");
  const tarifaJornalRaw = String(formData.get("tarifa_jornal") ?? "").trim();

  // --- Acceso ---
  const crear_acceso = formData.get("crear_acceso") === "on";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rolAppRaw = String(formData.get("rol_app") ?? "");

  // --- Validaciones persona ---
  if (!nombre_completo) {
    return { ...ESTADO_INICIAL, error: "El nombre completo es obligatorio." };
  }
  if (!esTipoVinculacionValido(tipoVinculacionRaw)) {
    return { ...ESTADO_INICIAL, error: "Selecciona un tipo de vinculación válido." };
  }
  const tipo = tipoVinculacionRaw;

  // --- Validaciones vinculación según tipo ---
  let salario_base: number | null = null;
  let periodo_pago: TipoPeriodoPago | null = null;
  let tarifa_jornal: number | null = null;

  if (tipo === "FIJO") {
    if (!salarioRaw) {
      return { ...ESTADO_INICIAL, error: "Salario base obligatorio para tipo FIJO." };
    }
    const s = Number(salarioRaw);
    if (!Number.isFinite(s) || s <= 0) {
      return { ...ESTADO_INICIAL, error: "Salario base debe ser un número positivo." };
    }
    salario_base = s;
    if (!esPeriodoPagoValido(periodoPagoRaw)) {
      return { ...ESTADO_INICIAL, error: "Selecciona un período de pago válido para tipo FIJO." };
    }
    periodo_pago = periodoPagoRaw;
  } else if (tipo === "JORNALERO") {
    if (!tarifaJornalRaw) {
      return { ...ESTADO_INICIAL, error: "Tarifa por jornal obligatoria para tipo JORNALERO." };
    }
    const t = Number(tarifaJornalRaw);
    if (!Number.isFinite(t) || t <= 0) {
      return { ...ESTADO_INICIAL, error: "Tarifa por jornal debe ser un número positivo." };
    }
    tarifa_jornal = t;
  }

  // --- Validaciones acceso ---
  let rol_app: RolUsuario | null = null;
  if (crear_acceso) {
    if (!email || !email.includes("@")) {
      return { ...ESTADO_INICIAL, error: "Email inválido para crear acceso." };
    }
    if (!password || password.length < 8) {
      return { ...ESTADO_INICIAL, error: "La contraseña debe tener al menos 8 caracteres." };
    }
    if (!esRolValido(rolAppRaw)) {
      return { ...ESTADO_INICIAL, error: "Selecciona un rol válido para el acceso." };
    }
    rol_app = rolAppRaw;
  }

  // --- 1. Crear persona ---
  const filas = await prisma.$queryRaw<{ next_id: bigint }[]>`
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM personas
  `;
  const nextId = filas[0].next_id;
  let personaId: bigint;
  try {
    const p = await prisma.personas.create({
      data: {
        id: nextId,
        nombre_completo,
        cedula,
        telefono,
        notas,
        activo: true,
      },
    });
    personaId = p.id;
  } catch (e) {
    const msg = (e as Error)?.message ?? "Error desconocido";
    if (/unique constraint.*cedula/i.test(msg)) {
      return { ...ESTADO_INICIAL, error: "Ya existe una persona con esa cédula." };
    }
    return { ...ESTADO_INICIAL, error: `No se pudo crear la persona: ${msg}` };
  }

  // --- 2. Crear vinculación ---
  try {
    await prisma.vinculaciones.create({
      data: {
        persona_id: personaId,
        tipo,
        rol_finca: rol_finca || null,
        salario_base,
        periodo_pago,
        tarifa_jornal,
      },
    });
  } catch (e) {
    // Rollback persona
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo crear la vinculación: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  // --- 3. Acceso al sistema (opcional) ---
  if (!crear_acceso) {
    revalidatePath("/jefe/equipo");
    redirect("/jefe/equipo");
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo },
  });

  if (authError || !authData?.user) {
    // Rollback: vinculación + persona
    await prisma.vinculaciones.deleteMany({ where: { persona_id: personaId } }).catch(() => {});
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
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
        nombre_completo,
        rol: rol_app!,
        persona_id: personaId,
        activo: true,
      },
    });
  } catch (e) {
    // Rollback completo
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    await prisma.vinculaciones.deleteMany({ where: { persona_id: personaId } }).catch(() => {});
    await prisma.personas.delete({ where: { id: personaId } }).catch(() => {});
    return {
      ...ESTADO_INICIAL,
      error: `No se pudo enlazar el acceso: ${(e as Error)?.message ?? "desconocido"}.`,
    };
  }

  revalidatePath("/jefe/equipo");
  redirect("/jefe/equipo");
}

export async function cambiarEstadoMiembro(formData: FormData) {
  await requerirUsuario("JEFE");

  const idRaw = String(formData.get("id") ?? "");
  const activar = formData.get("activar") === "true";

  if (!/^\d+$/.test(idRaw)) return;
  const id = BigInt(idRaw);

  await prisma.personas.update({
    where: { id },
    data: { activo: activar },
  });

  await prisma.usuarios.updateMany({
    where: { persona_id: id },
    data: { activo: activar },
  });

  revalidatePath("/jefe/equipo");
}
```

- [ ] **Step 9.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: errores de este archivo deben desaparecer. Quedan errores en `page.tsx` y `FormularioNuevoMiembro.tsx`.

- [ ] **Step 9.3: Commit**

```bash
git add "app/(app)/jefe/equipo/acciones.ts"
git commit -m "feat(equipo): server action crearMiembro usa personas + vinculaciones

Reemplaza la creación de trabajador por persona + vinculación con campos
condicionales por tipo (FIJO requiere salario_base + periodo_pago;
JORNALERO requiere tarifa_jornal; CONTRATISTA y FAMILIAR sin financiero).
Rollback completo si falla cualquier paso intermedio."
```

---

## Task 10: Actualizar `FormularioNuevoMiembro.tsx`

**Files:**
- Modify: `app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx`

**Why:** El formulario debe pedir tipo de vinculación y mostrar campos condicionales.

- [ ] **Step 10.1: Reemplazar el contenido del archivo**

Sobrescribir con:

```typescript
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { crearMiembro, type EstadoFormulario } from "../acciones";

const ESTADO_INICIAL: EstadoFormulario = { error: null, exito: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

const ROLES_FINCA_SUGERIDOS = [
  "Jefe de finca",
  "Bodeguero",
  "Almacenista",
  "Recolector",
  "Trabajador de campo",
];

export function FormularioNuevoMiembro() {
  const [estado, accion, pendiente] = useActionState(crearMiembro, ESTADO_INICIAL);
  const [tipoVinculacion, setTipoVinculacion] = useState<
    "FIJO" | "JORNALERO" | "CONTRATISTA" | "FAMILIAR"
  >("FIJO");
  const [crearAcceso, setCrearAcceso] = useState(true);

  return (
    <form action={accion} className="space-y-6" noValidate>
      <Link
        href="/jefe/equipo"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Equipo
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Nuevo miembro
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Agregar al equipo
        </h1>
      </header>

      {/* Sección 1: Datos de la persona */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos de la persona
        </h2>

        <div>
          <label htmlFor="nombre_completo" className={labelBase}>
            Nombre completo <span className="text-estado-vencida">*</span>
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cedula" className={labelBase}>
              Cédula
            </label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelBase}>
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputBase}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notas" className={labelBase}>
            Notas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            placeholder="Observaciones internas (opcional)."
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>
      </section>

      {/* Sección 2: Vinculación con la finca */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación con la finca
        </h2>

        <div>
          <label htmlFor="tipo_vinculacion" className={labelBase}>
            Tipo <span className="text-estado-vencida">*</span>
          </label>
          <select
            id="tipo_vinculacion"
            name="tipo_vinculacion"
            required
            value={tipoVinculacion}
            onChange={(e) =>
              setTipoVinculacion(
                e.target.value as "FIJO" | "JORNALERO" | "CONTRATISTA" | "FAMILIAR",
              )
            }
            className={inputBase}
          >
            <option value="FIJO">Fijo (sueldo periódico)</option>
            <option value="JORNALERO">Jornalero (por días)</option>
            <option value="CONTRATISTA">Contratista (por servicio)</option>
            <option value="FAMILIAR">Familia / propietario</option>
          </select>
        </div>

        <div>
          <label htmlFor="rol_finca" className={labelBase}>
            Rol en la finca
          </label>
          <input
            id="rol_finca"
            name="rol_finca"
            type="text"
            list="roles-finca-sugeridos"
            placeholder="Ej. Recolector, Bodeguero, Apicultor"
            className={inputBase}
          />
          <datalist id="roles-finca-sugeridos">
            {ROLES_FINCA_SUGERIDOS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <p className="mt-1.5 text-xs text-zelanda-verde-700">
            Texto libre; distinto al rol del sistema.
          </p>
        </div>

        {tipoVinculacion === "FIJO" ? (
          <div className="grid grid-cols-1 gap-4 border-t border-zelanda-beige-200 pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="salario_base" className={labelBase}>
                Salario base <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="salario_base"
                name="salario_base"
                type="number"
                inputMode="numeric"
                min="0"
                step="1000"
                required
                placeholder="Ej. 1300000"
                className={inputBase}
              />
            </div>
            <div>
              <label htmlFor="periodo_pago" className={labelBase}>
                Período <span className="text-estado-vencida">*</span>
              </label>
              <select
                id="periodo_pago"
                name="periodo_pago"
                required
                defaultValue="QUINCENAL"
                className={inputBase}
              >
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="SEMANAL">Semanal</option>
              </select>
            </div>
          </div>
        ) : null}

        {tipoVinculacion === "JORNALERO" ? (
          <div className="border-t border-zelanda-beige-200 pt-4">
            <label htmlFor="tarifa_jornal" className={labelBase}>
              Tarifa por jornal <span className="text-estado-vencida">*</span>
            </label>
            <input
              id="tarifa_jornal"
              name="tarifa_jornal"
              type="number"
              inputMode="numeric"
              min="0"
              step="1000"
              required
              placeholder="Ej. 50000"
              className={inputBase}
            />
            <p className="mt-1.5 text-xs text-zelanda-verde-700">
              Tarifa default que cobra por día. Se puede ajustar por jornada
              cuando se implemente la capa financiera.
            </p>
          </div>
        ) : null}
      </section>

      {/* Sección 3: Acceso al sistema */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Acceso al sistema
        </h2>

        <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="crear_acceso"
            checked={crearAcceso}
            onChange={(e) => setCrearAcceso(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700 focus:ring-zelanda-verde-600/20"
          />
          <span className="text-sm">
            <span className="font-medium text-zelanda-verde-900">
              Crear cuenta para entrar a la app
            </span>
            <span className="mt-0.5 block text-xs text-zelanda-verde-700">
              Si la persona no usará la app (contratista de un servicio puntual,
              jornalero ocasional, familia que ya tiene acceso), déjalo sin marcar.
            </span>
          </span>
        </label>

        {crearAcceso ? (
          <div className="space-y-4 border-t border-zelanda-beige-200 pt-4">
            <div>
              <label htmlFor="email" className={labelBase}>
                Correo <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required={crearAcceso}
                className={inputBase}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelBase}>
                Contraseña <span className="text-estado-vencida">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={crearAcceso}
                minLength={8}
                className={inputBase}
              />
              <p className="mt-1.5 text-xs text-zelanda-verde-700">
                Mínimo 8 caracteres. Compártela por canal seguro.
              </p>
            </div>

            <div>
              <label htmlFor="rol_app" className={labelBase}>
                Rol en la app <span className="text-estado-vencida">*</span>
              </label>
              <select
                id="rol_app"
                name="rol_app"
                required={crearAcceso}
                defaultValue="TRABAJADOR"
                className={inputBase}
              >
                <option value="TRABAJADOR">Trabajador</option>
                <option value="BODEGA">Bodega</option>
                <option value="ALMACEN">Almacén</option>
                <option value="JEFE">Jefe</option>
              </select>
            </div>
          </div>
        ) : null}
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/jefe/equipo"
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Crear miembro"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 10.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: errores de este archivo desaparecen. Quedan errores en `page.tsx`.

- [ ] **Step 10.3: Commit**

```bash
git add "app/(app)/jefe/equipo/nuevo/FormularioNuevoMiembro.tsx"
git commit -m "feat(equipo): formulario nuevo miembro con tipo de vinculación

Selector de tipo (FIJO/JORNALERO/CONTRATISTA/FAMILIAR) con campos
condicionales: FIJO pide salario_base+periodo_pago, JORNALERO pide
tarifa_jornal. Elimina campo es_apicultor (sin uso en el nuevo modelo)."
```

---

## Task 11: Actualizar `app/(app)/jefe/equipo/page.tsx`

**Files:**
- Modify: `app/(app)/jefe/equipo/page.tsx`

**Why:** La lista usa `trabajadores`. Reemplazar por `personas` con su `vinculaciones` activa.

- [ ] **Step 11.1: Reemplazar el contenido**

Sobrescribir el archivo con:

```typescript
import Link from "next/link";
import { Plus, UserPlus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeRol, BadgeBase } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import { cambiarEstadoMiembro } from "./acciones";
import type { RolUsuario, TipoVinculacion } from "@/types";

export const metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  await requerirUsuario("JEFE");

  const personas = await prisma.personas.findMany({
    where: { deleted_at: null },
    include: {
      usuarios: {
        select: { id: true, email: true, rol: true, activo: true },
      },
      vinculaciones: {
        where: { fecha_fin: null },
        orderBy: { fecha_inicio: "desc" },
        take: 1,
        select: { tipo: true, rol_finca: true },
      },
    },
    orderBy: [{ activo: "desc" }, { nombre_completo: "asc" }],
  });

  const totalActivos = personas.filter((p) => p.activo).length;
  const totalConAcceso = personas.filter((p) => p.usuarios.length > 0).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Gestión
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Equipo
          </h1>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            {totalActivos} activos · {totalConAcceso} con acceso
          </p>
        </div>
        <Link
          href="/jefe/equipo/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3.5 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </header>

      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-zelanda-verde-700/60" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Aún no hay miembros del equipo
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Empieza creando a los trabajadores fijos y jornaleros.
          </p>
          <Link
            href="/jefe/equipo/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-4 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave"
          >
            <Plus className="h-4 w-4" />
            Agregar primer miembro
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {personas.map((p) => {
            const usuario = p.usuarios[0];
            const vinc = p.vinculaciones[0];
            const idStr = String(p.id);
            return (
              <li
                key={idStr}
                className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <Link
                  href={`/jefe/equipo/${idStr}`}
                  className="flex flex-1 items-center gap-3 min-w-0"
                >
                  <AvatarIniciales id={idStr} nombre={p.nombre_completo} tamano="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {p.nombre_completo}
                    </p>
                    <p className="truncate text-xs text-zelanda-verde-700">
                      {vinc?.rol_finca ?? "Sin rol"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {vinc ? (
                        <BadgeBase tono="info">
                          {ETIQUETA_TIPO_VINCULACION[vinc.tipo as TipoVinculacion]}
                        </BadgeBase>
                      ) : (
                        <BadgeBase tono="alerta">Sin vinculación</BadgeBase>
                      )}
                      {usuario ? (
                        <BadgeRol rol={usuario.rol as RolUsuario} />
                      ) : (
                        <BadgeBase tono="neutro">Sin acceso</BadgeBase>
                      )}
                      {!p.activo ? <BadgeBase tono="alerta">Inactivo</BadgeBase> : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
                </Link>
                <form action={cambiarEstadoMiembro}>
                  <input type="hidden" name="id" value={idStr} />
                  <input
                    type="hidden"
                    name="activar"
                    value={p.activo ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="min-h-touch rounded-lg px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:bg-zelanda-beige-100 hover:text-zelanda-verde-900"
                  >
                    {p.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: este archivo compila. Si hay error de tipo en `vinc.tipo as TipoVinculacion`, confirma que el enum de Prisma coincide.

- [ ] **Step 11.3: Verificar build**

Run: `npm run build`
Expected: `Compiled successfully`. Si falla con errores de runtime en otras rutas, anotar y arreglar después de los siguientes tasks.

- [ ] **Step 11.4: Commit**

```bash
git add "app/(app)/jefe/equipo/page.tsx"
git commit -m "feat(equipo): lista usa personas + vinculaciones

Muestra tipo de vinculación como badge, rol_finca del vínculo activo,
estado del acceso. Cada fila linkea a /jefe/equipo/[id] (próximo task)."
```

---

## Task 12: Crear página de detalle `/jefe/equipo/[id]`

**Files:**
- Create: `app/(app)/jefe/equipo/[id]/page.tsx`

**Why:** Pantalla para ver la persona, su vinculación activa, su histórico de vínculos.

- [ ] **Step 12.1: Crear el archivo**

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Calendar, Phone, IdCard } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeRol, BadgeBase } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import { formatearFechaCorta } from "@/lib/utils";
import type { RolUsuario, TipoVinculacion } from "@/types";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) return { title: "Miembro no encontrado" };
  const persona = await prisma.personas.findUnique({
    where: { id: idBig },
    select: { nombre_completo: true },
  });
  return { title: persona?.nombre_completo ?? "Miembro no encontrado" };
}

export default async function DetalleMiembro({
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
      usuarios: { select: { id: true, email: true, rol: true, activo: true } },
      vinculaciones: { orderBy: { fecha_inicio: "desc" } },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const vincActiva = persona.vinculaciones.find((v) => v.fecha_fin === null);
  const historial = persona.vinculaciones.filter((v) => v.fecha_fin !== null);
  const usuario = persona.usuarios[0];
  const idStr = String(persona.id);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/equipo"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Equipo
      </Link>

      <header className="flex items-start gap-4">
        <AvatarIniciales id={idStr} nombre={persona.nombre_completo} tamano="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl leading-tight text-zelanda-verde-900">
            {persona.nombre_completo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {vincActiva ? (
              <BadgeBase tono="info">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
              </BadgeBase>
            ) : (
              <BadgeBase tono="alerta">Sin vinculación</BadgeBase>
            )}
            {usuario ? <BadgeRol rol={usuario.rol as RolUsuario} /> : null}
            {!persona.activo ? <BadgeBase tono="alerta">Inactivo</BadgeBase> : null}
          </div>
        </div>
        <Link
          href={`/jefe/equipo/${idStr}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>

      {/* Datos personales */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos personales
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <IdCard className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Cédula</dt>
            <dd className="text-zelanda-verde-900">{persona.cedula ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Teléfono</dt>
            <dd className="text-zelanda-verde-900">{persona.telefono ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Nacimiento</dt>
            <dd className="text-zelanda-verde-900">
              {persona.fecha_nacimiento ? formatearFechaCorta(persona.fecha_nacimiento) : "—"}
            </dd>
          </div>
        </dl>
        {persona.notas ? (
          <p className="mt-4 border-t border-zelanda-beige-200 pt-4 text-sm leading-relaxed text-zelanda-verde-700">
            {persona.notas}
          </p>
        ) : null}
      </section>

      {/* Vinculación activa */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación activa
        </h2>
        {vincActiva ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Tipo</dt>
              <dd className="mt-0.5 font-medium text-zelanda-verde-900">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Rol en la finca</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{vincActiva.rol_finca ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Desde</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {formatearFechaCorta(vincActiva.fecha_inicio)}
              </dd>
            </div>
            {vincActiva.salario_base ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
                  Salario base ({vincActiva.periodo_pago?.toLowerCase()})
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  $ {Number(vincActiva.salario_base).toLocaleString("es-CO")}
                </dd>
              </div>
            ) : null}
            {vincActiva.tarifa_jornal ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
                  Tarifa por jornal
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  $ {Number(vincActiva.tarifa_jornal).toLocaleString("es-CO")}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Sin vinculación activa.
          </p>
        )}
      </section>

      {/* Histórico */}
      {historial.length > 0 ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Histórico de vinculaciones
          </h2>
          <ul className="mt-3 space-y-3">
            {historial.map((v) => (
              <li
                key={String(v.id)}
                className="border-l-2 border-zelanda-beige-300 pl-3"
              >
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {ETIQUETA_TIPO_VINCULACION[v.tipo as TipoVinculacion]}
                  {v.rol_finca ? ` · ${v.rol_finca}` : ""}
                </p>
                <p className="text-xs text-zelanda-verde-700">
                  {formatearFechaCorta(v.fecha_inicio)} → {v.fecha_fin ? formatearFechaCorta(v.fecha_fin) : "activo"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Acceso */}
      {usuario ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Acceso al sistema
          </h2>
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
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 12.2: Verificar typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos pasan.

- [ ] **Step 12.3: Commit**

```bash
git add "app/(app)/jefe/equipo/[id]/page.tsx"
git commit -m "feat(equipo): página detalle /jefe/equipo/[id]

Muestra avatar, datos personales, vinculación activa con campos
financieros, histórico de vinculaciones y datos de acceso. Botón a
/editar para modificar."
```

---

## Task 13: Crear página de edición `/jefe/equipo/[id]/editar`

**Files:**
- Create: `app/(app)/jefe/equipo/[id]/acciones.ts`
- Create: `app/(app)/jefe/equipo/[id]/editar/FormularioEditarMiembro.tsx`
- Create: `app/(app)/jefe/equipo/[id]/editar/page.tsx`

**Why:** Permitir editar datos personales y cambiar la vinculación activa (cierra anterior, abre nueva). Sin esto, el jefe no puede ajustar las vinculaciones FAMILIAR migradas inicialmente.

- [ ] **Step 13.1: Crear `acciones.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import type { TipoVinculacion, TipoPeriodoPago } from "@/types";

export type EstadoEdicion = { error: string | null };
const ESTADO_INICIAL: EstadoEdicion = { error: null };

function esTipoValido(v: string): v is TipoVinculacion {
  return v === "FIJO" || v === "JORNALERO" || v === "CONTRATISTA" || v === "FAMILIAR";
}
function esPeriodoValido(v: string): v is TipoPeriodoPago {
  return v === "MENSUAL" || v === "QUINCENAL" || v === "SEMANAL";
}

function parsearId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function actualizarPersonaYVinculacion(
  _prev: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  await requerirUsuario("JEFE");

  const personaId = parsearId(String(formData.get("persona_id") ?? ""));
  if (!personaId) return { error: "ID de persona inválido." };

  // --- Datos persona ---
  const nombre_completo = String(formData.get("nombre_completo") ?? "").trim();
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre_completo) return { error: "Nombre completo obligatorio." };

  // --- Vinculación ---
  const cambiarVinc = formData.get("cambiar_vinculacion") === "on";

  await prisma.personas.update({
    where: { id: personaId },
    data: { nombre_completo, cedula, telefono, notas },
  });

  if (cambiarVinc) {
    const tipoRaw = String(formData.get("nueva_tipo_vinculacion") ?? "");
    const rol_finca = String(formData.get("nueva_rol_finca") ?? "").trim() || null;
    const salarioRaw = String(formData.get("nueva_salario_base") ?? "").trim();
    const periodoRaw = String(formData.get("nueva_periodo_pago") ?? "");
    const tarifaRaw = String(formData.get("nueva_tarifa_jornal") ?? "").trim();

    if (!esTipoValido(tipoRaw)) {
      return { error: "Tipo de vinculación inválido." };
    }
    const tipo = tipoRaw;

    let salario_base: number | null = null;
    let periodo_pago: TipoPeriodoPago | null = null;
    let tarifa_jornal: number | null = null;

    if (tipo === "FIJO") {
      const s = Number(salarioRaw);
      if (!Number.isFinite(s) || s <= 0) {
        return { error: "Salario base inválido para FIJO." };
      }
      salario_base = s;
      if (!esPeriodoValido(periodoRaw)) {
        return { error: "Período de pago inválido para FIJO." };
      }
      periodo_pago = periodoRaw;
    } else if (tipo === "JORNALERO") {
      const t = Number(tarifaRaw);
      if (!Number.isFinite(t) || t <= 0) {
        return { error: "Tarifa por jornal inválida para JORNALERO." };
      }
      tarifa_jornal = t;
    }

    // Cerrar vinculación activa anterior, crear nueva — en transacción.
    await prisma.$transaction(async (tx) => {
      await tx.vinculaciones.updateMany({
        where: { persona_id: personaId, fecha_fin: null },
        data: { fecha_fin: new Date() },
      });
      await tx.vinculaciones.create({
        data: {
          persona_id: personaId,
          tipo,
          rol_finca,
          salario_base,
          periodo_pago,
          tarifa_jornal,
        },
      });
    });
  }

  revalidatePath(`/jefe/equipo/${personaId}`);
  revalidatePath("/jefe/equipo");
  redirect(`/jefe/equipo/${personaId}`);
}
```

- [ ] **Step 13.2: Crear `FormularioEditarMiembro.tsx`**

```typescript
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { actualizarPersonaYVinculacion, type EstadoEdicion } from "../acciones";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import type { TipoVinculacion } from "@/types";

const ESTADO_INICIAL: EstadoEdicion = { error: null };

const inputBase =
  "mt-1.5 block min-h-touch w-full rounded-lg border border-zelanda-beige-300 bg-white px-3 py-2.5 text-base text-zelanda-verde-900 shadow-suave outline-none transition focus:border-zelanda-verde-600 focus:ring-2 focus:ring-zelanda-verde-600/20";

const labelBase = "block text-sm font-medium text-zelanda-verde-800";

type Persona = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  telefono: string | null;
  notas: string | null;
};

type VinculacionActiva = {
  tipo: TipoVinculacion;
  rol_finca: string | null;
} | null;

export function FormularioEditarMiembro({
  persona,
  vincActiva,
}: {
  persona: Persona;
  vincActiva: VinculacionActiva;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarPersonaYVinculacion,
    ESTADO_INICIAL,
  );
  const [cambiarVinc, setCambiarVinc] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoVinculacion>("FIJO");

  return (
    <form action={accion} className="space-y-6" noValidate>
      <input type="hidden" name="persona_id" value={persona.id} />

      <Link
        href={`/jefe/equipo/${persona.id}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {persona.nombre_completo}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Editar
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {persona.nombre_completo}
        </h1>
      </header>

      {/* Datos */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos personales
        </h2>
        <div>
          <label htmlFor="nombre_completo" className={labelBase}>
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            type="text"
            required
            defaultValue={persona.nombre_completo}
            className={inputBase}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cedula" className={labelBase}>Cédula</label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              defaultValue={persona.cedula ?? ""}
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelBase}>Teléfono</label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              defaultValue={persona.telefono ?? ""}
              className={inputBase}
            />
          </div>
        </div>
        <div>
          <label htmlFor="notas" className={labelBase}>Notas</label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            defaultValue={persona.notas ?? ""}
            className={`${inputBase} min-h-[60px] resize-y`}
          />
        </div>
      </section>

      {/* Cambiar vinculación */}
      <section className="space-y-4 rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación
        </h2>
        <p className="text-sm text-zelanda-verde-700">
          Activa actualmente:{" "}
          <span className="font-medium text-zelanda-verde-900">
            {vincActiva
              ? ETIQUETA_TIPO_VINCULACION[vincActiva.tipo] +
                (vincActiva.rol_finca ? ` (${vincActiva.rol_finca})` : "")
              : "Sin vinculación"}
          </span>
        </p>

        <label className="flex items-start gap-3 rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
          <input
            type="checkbox"
            name="cambiar_vinculacion"
            checked={cambiarVinc}
            onChange={(e) => setCambiarVinc(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zelanda-beige-300 text-zelanda-verde-700"
          />
          <span className="text-sm">
            <span className="font-medium text-zelanda-verde-900">
              Cambiar tipo de vinculación
            </span>
            <span className="mt-0.5 block text-xs text-zelanda-verde-700">
              Cierra la vinculación activa actual (con la fecha de hoy) y crea
              una nueva. El histórico queda preservado.
            </span>
          </span>
        </label>

        {cambiarVinc ? (
          <div className="space-y-4 border-t border-zelanda-beige-200 pt-4">
            <div>
              <label htmlFor="nueva_tipo_vinculacion" className={labelBase}>
                Nuevo tipo
              </label>
              <select
                id="nueva_tipo_vinculacion"
                name="nueva_tipo_vinculacion"
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoVinculacion)}
                className={inputBase}
              >
                <option value="FIJO">Fijo</option>
                <option value="JORNALERO">Jornalero</option>
                <option value="CONTRATISTA">Contratista</option>
                <option value="FAMILIAR">Familia / propietario</option>
              </select>
            </div>
            <div>
              <label htmlFor="nueva_rol_finca" className={labelBase}>
                Rol en la finca
              </label>
              <input
                id="nueva_rol_finca"
                name="nueva_rol_finca"
                type="text"
                className={inputBase}
              />
            </div>
            {nuevoTipo === "FIJO" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nueva_salario_base" className={labelBase}>
                    Salario base
                  </label>
                  <input
                    id="nueva_salario_base"
                    name="nueva_salario_base"
                    type="number"
                    min="0"
                    step="1000"
                    required={nuevoTipo === "FIJO"}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="nueva_periodo_pago" className={labelBase}>
                    Período
                  </label>
                  <select
                    id="nueva_periodo_pago"
                    name="nueva_periodo_pago"
                    defaultValue="QUINCENAL"
                    required={nuevoTipo === "FIJO"}
                    className={inputBase}
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="QUINCENAL">Quincenal</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </div>
              </div>
            ) : null}
            {nuevoTipo === "JORNALERO" ? (
              <div>
                <label htmlFor="nueva_tarifa_jornal" className={labelBase}>
                  Tarifa por jornal
                </label>
                <input
                  id="nueva_tarifa_jornal"
                  name="nueva_tarifa_jornal"
                  type="number"
                  min="0"
                  step="1000"
                  required={nuevoTipo === "JORNALERO"}
                  className={inputBase}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link
          href={`/jefe/equipo/${persona.id}`}
          className="flex-1 rounded-lg border border-zelanda-beige-300 px-4 py-3 text-center text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-zelanda-verde-700 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 13.3: Crear `page.tsx`**

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioEditarMiembro } from "./FormularioEditarMiembro";
import type { TipoVinculacion } from "@/types";

export const metadata: Metadata = { title: "Editar miembro" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaEditarMiembro({
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
      vinculaciones: {
        where: { fecha_fin: null },
        take: 1,
        select: { tipo: true, rol_finca: true },
      },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const vincActiva = persona.vinculaciones[0]
    ? {
        tipo: persona.vinculaciones[0].tipo as TipoVinculacion,
        rol_finca: persona.vinculaciones[0].rol_finca,
      }
    : null;

  return (
    <FormularioEditarMiembro
      persona={{
        id: String(persona.id),
        nombre_completo: persona.nombre_completo,
        cedula: persona.cedula,
        telefono: persona.telefono,
        notas: persona.notas,
      }}
      vincActiva={vincActiva}
    />
  );
}
```

- [ ] **Step 13.4: Verificar typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pasa.

- [ ] **Step 13.5: Commit**

```bash
git add "app/(app)/jefe/equipo/[id]/"
git commit -m "feat(equipo): página editar /jefe/equipo/[id]/editar

Server action actualizarPersonaYVinculacion: actualiza datos personales y
opcionalmente cambia el tipo de vinculación (cierra la activa con fecha
de hoy y crea una nueva en una transacción). Form con toggle 'Cambiar
vinculación' que muestra los campos según el tipo nuevo."
```

---

## Task 14: Actualizar `supabase/policies.sql` y aplicar

**Files:**
- Modify: `supabase/policies.sql`

**Why:** Las policies actuales usan `trabajador_id_actual()` (que ya no existe) y `trabajador_id` (columna renombrada). Hay que actualizarlas + agregar policies para las nuevas tablas.

- [ ] **Step 14.1: Aplicar cambios al archivo**

A) **Reemplazar la función `trabajador_id_actual()` en la sección HELPERS** (cerca del inicio del archivo):

Eliminar el bloque:
```sql
CREATE OR REPLACE FUNCTION public.trabajador_id_actual()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trabajador_id FROM public.usuarios WHERE id = auth.uid();
$$;
```
Reemplazar por:
```sql
CREATE OR REPLACE FUNCTION public.persona_id_actual()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT persona_id FROM public.usuarios WHERE id = auth.uid();
$$;
```

Y la línea `GRANT EXECUTE ON FUNCTION public.trabajador_id_actual() TO authenticated;` reemplazarla por:
```sql
GRANT EXECUTE ON FUNCTION public.persona_id_actual() TO authenticated;
```

B) **Reemplazar referencias a `trabajadores` con `personas`** en la sección "trabajadores":

Cambiar:
```sql
-- ============================================================
-- trabajadores
-- ============================================================

DROP POLICY IF EXISTS trabajadores_select ON public.trabajadores;
CREATE POLICY trabajadores_select ON public.trabajadores FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS trabajadores_jefe_write ON public.trabajadores;
CREATE POLICY trabajadores_jefe_write ON public.trabajadores FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());
```
Por:
```sql
-- ============================================================
-- personas
-- ============================================================

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personas_select ON public.personas;
CREATE POLICY personas_select ON public.personas FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS personas_jefe_write ON public.personas;
CREATE POLICY personas_jefe_write ON public.personas FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

-- ============================================================
-- vinculaciones
-- ============================================================

ALTER TABLE public.vinculaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vinculaciones_select ON public.vinculaciones;
CREATE POLICY vinculaciones_select ON public.vinculaciones FOR SELECT
  USING (
    public.es_jefe()
    OR persona_id = public.persona_id_actual()
  );

DROP POLICY IF EXISTS vinculaciones_jefe_write ON public.vinculaciones;
CREATE POLICY vinculaciones_jefe_write ON public.vinculaciones FOR ALL
  USING (public.es_jefe())
  WITH CHECK (public.es_jefe());
```

C) **Reemplazar todas las apariciones restantes de `trabajador_id_actual` por `persona_id_actual`** en el archivo. (Hay varias en las secciones de asignaciones, registros_avance, novedades, despachos, despacho_items, cosechas, salidas_cosecha, movimientos_insumo.)

Comando para localizar las referencias antes de editar manualmente:
Run (PowerShell): `Select-String -Path supabase/policies.sql -Pattern 'trabajador_id_actual|trabajador_id|trabajadores'`

Editar cada match. La regla:
- `trabajador_id_actual()` → `persona_id_actual()`
- `trabajador_id =` → `persona_id =` (en condiciones de WHERE/USING)

- [ ] **Step 14.2: Aplicar las policies a la BD**

Run: `npx prisma db execute --file supabase/policies.sql --schema prisma/schema.prisma`
Expected: `Script executed successfully.`

Si falla, leer el error, corregir el SQL, re-correr.

- [ ] **Step 14.3: Verificar las policies con un query rápido**

Crear y correr este script ad-hoc (no se commitea):

```javascript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const policies = await prisma.$queryRawUnsafe(`
  SELECT schemaname, tablename, policyname FROM pg_policies
  WHERE schemaname = 'public' AND (policyname LIKE '%personas%' OR policyname LIKE '%vinculaciones%')
`);
console.log(policies);
await prisma.$disconnect();
```

Guardarlo como `check-policies.mjs` (gitignored automáticamente al estar en raíz sin tracked) o como temp en `/tmp/`. Run y verificar que hay policies para personas y vinculaciones.

- [ ] **Step 14.4: Commit**

```bash
git add supabase/policies.sql
git commit -m "feat(rls): policies para personas, vinculaciones + persona_id_actual

Reemplaza trabajador_id_actual() por persona_id_actual(). Renombra
referencias trabajador_id → persona_id en las policies de asignaciones,
registros_avance, novedades, despachos, despacho_items, cosechas,
salidas_cosecha y movimientos_insumo. Agrega RLS y policies para las
nuevas tablas personas y vinculaciones."
```

---

## Task 15: Actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Why:** El doc maestro tiene info desactualizada sobre el sub-rol APICULTOR y la tabla trabajadores. Actualizar para reflejar la nueva realidad.

- [ ] **Step 15.1: Editar §4.4 (rol TRABAJADOR)**

En `CLAUDE.md`, ubicar la sección `### 4.4 TRABAJADOR` y eliminar la línea:
```
- **Sub-rol APICULTOR**: trabajador con flag `es_apicultor=true`. Solo a estos se les asignan tareas de apicultura y se les despacha equipo apícola.
```

(No reemplazar — solo eliminar.)

- [ ] **Step 15.2: Editar §5.5 (Apicultura)**

Ubicar:
```
### 5.5 Apicultura
- 2 apiarios visibles en mapa
- Tareas específicas asignables solo a apicultores
- Equipo específico en bodega (trajes, ahumador, etc.)
```

Reemplazar por:
```
### 5.5 Apicultura
- 2 apiarios visibles en mapa
- Tareas específicas (visita al apiario, cosecha de miel) asignables a cualquier trabajador disponible. La apicultura no requiere rol designado — el conocimiento se reparte entre el equipo.
- Equipo específico en bodega (trajes, ahumador, etc.)
```

- [ ] **Step 15.3: Editar §5.6 (Equipo / Trabajadores)**

Reemplazar todo el bloque `### 5.6 Equipo / Trabajadores` por:

```
### 5.6 Personas y Vínculos
La operación de la finca involucra 4 perfiles de personas, modelados como `personas` (identidad invariante) + `vinculaciones` (cada relación con la finca en el tiempo, con histórico):

- **FIJO**: empleado con sueldo periódico (mensual/quincenal/semanal).
- **JORNALERO**: contratado por días, con tarifa por jornal.
- **CONTRATISTA**: contratado por servicios puntuales (puente, cortar madera, cerca). Cobra por el servicio.
- **FAMILIAR**: familia / propietarios, sin compensación vía app.

Una persona puede transitar entre vínculos en el tiempo (jornalero → fijo, fijo que sale y vuelve como contratista). Cada cambio cierra la vinculación anterior y abre una nueva, preservando histórico.

Datos por persona: nombre completo, cédula, teléfono, fecha de nacimiento, foto, notas, activo.

Datos por vinculación: tipo, rol_finca (texto libre, ej "Recolector senior"), fecha_inicio, fecha_fin, salario_base y periodo_pago (solo FIJO), tarifa_jornal (solo JORNALERO), esquema_pago_destajo (solo FIJO/JORNALERO).

La capa financiera (cálculo de saldos, pagos, tarifas configurables, servicios contratados con sus pagos parciales, jornales, ausencias) está diseñada como Fase 2 — ver `docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md`.
```

- [ ] **Step 15.4: Editar §6 (Esquema de base de datos)**

En la tabla de "Decisiones de diseño clave", agregar al final una nueva fila:

```
| Tablas `personas` + `vinculaciones` reemplazan `trabajadores` | La realidad operacional tiene 4 perfiles (fijos, jornaleros, contratistas, familia) y una persona puede transitar entre ellos. Histórico preservado. |
```

Y actualizar el conteo: donde dice "15 tablas + 2 vistas + 1 tabla de movimientos", actualizarlo al estado real post-migración (`personas + vinculaciones + 15 otras tablas - trabajadores`).

- [ ] **Step 15.5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): personas + vinculaciones; quitar sub-rol APICULTOR

§4.4: elimina sub-rol APICULTOR (no hay apicultor designado).
§5.5: tareas de apicultura asignables a cualquier trabajador.
§5.6: reemplaza 'Equipo / Trabajadores' por 'Personas y Vínculos'
con los 4 perfiles. Referencia el DRAFT de capa financiera.
§6: agrega fila de decisión sobre personas + vinculaciones."
```

---

## Task 16: Smoke test final y deploy

**Files:**
- (ninguno modificado)

**Why:** Verificar end-to-end que todo el sistema funciona después de la migración antes de push a producción.

- [ ] **Step 16.1: Verificación local completa**

Run en paralelo (3 comandos):
```
npx tsc --noEmit
npm run lint
npm run build
```
Expected: los tres pasan sin errores. Si alguno falla, parar y corregir.

- [ ] **Step 16.2: Smoke test con dev server**

Run: `npm run dev` en background.

Hacer manualmente en `http://localhost:3000`:
1. Login con tu jefe — debe redirigir a `/jefe`. ✓
2. Pulsar **Equipo** en bottom nav. Lista debe cargar mostrando solo a tu jefe con badge "Familia" y badge "Jefe". ✓
3. Pulsar la fila del jefe → ir a `/jefe/equipo/<id>`. Detalle muestra "Familia" en vinculación activa, sin salario. ✓
4. Pulsar **Editar** → marcar "Cambiar tipo de vinculación", elegir FIJO, llenar salario_base=600000, periodo QUINCENAL, guardar.
5. Volver a verificar el detalle: ahora muestra "Fijo", $600.000 quincenal, y en histórico la vinculación FAMILIAR cerrada hoy. ✓
6. Pulsar **Nuevo** en lista → crear un JORNALERO con tarifa $50.000, sin acceso, guardar. Volver a lista, debe aparecer. ✓
7. En el detalle de ese jornalero, "Editar" → cambiar a FIJO con salario, guardar, verificar histórico. ✓

Kill el dev server.

- [ ] **Step 16.3: Verificar la BD con el script**

Run: `npm run verificar:migracion`
Expected:
- Estado: Post-migración.
- personas rows = 2 (jefe + jornalero creado).
- vinculaciones rows ≥ 3 (FAMILIAR cerrada del jefe + FIJO activa del jefe + JORNALERO del nuevo).
- Tipos: al menos FAMILIAR (cerrada), FIJO (1), JORNALERO (1).

- [ ] **Step 16.4: Push a producción**

```bash
git push origin main
```

Esperar 1-2 min a que Vercel deploye. Verificar:

Run: `curl -sS -o /dev/null -w "%{http_code}\n" https://zelanda.vercel.app/jefe/equipo`
Expected: `307` (redirect a login porque no hay sesión).

Abrir en navegador del celular https://zelanda.vercel.app/login, hacer login, navegar a /jefe/equipo, /jefe/equipo/[id], /jefe/equipo/[id]/editar. Verificar visualmente. Si algo se rompe en producción pero no en local, revisar logs de Vercel.

- [ ] **Step 16.5: Update memoria de proyecto**

Editar `C:\Users\samue\.claude\projects\d--Zelanda\memory\project_fincapp.md` para reflejar el estado post-migración.

Cambiar la línea de "Estado actual" a:
```
**Estado actual (2026-05-11):** **Núcleo personas+vinculaciones desplegado.** trabajadores reemplazado por personas + vinculaciones con histórico. 4 perfiles soportados (FIJO/JORNALERO/CONTRATISTA/FAMILIAR). Sin capa financiera todavía (DRAFT preservado en `docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md`). Siguiente: pendiente — revisar `docs/decisiones-pendientes.md` y decidir qué se implementa primero (capa financiera, captura de polígonos, Fase 3 tareas, etc.).
```

- [ ] **Step 16.6: Commit final del memoria + cierre**

No commitear archivos de `C:\Users\samue\.claude\` (esos son personales). Solo verificar que el código del repo está en sync.

Run: `git status --short`
Expected: vacío.

Run: `git log --oneline -8`
Expected: ver todos los commits del plan.

---

## Self-review

Hice las siguientes verificaciones inline:

**Spec coverage:**
- §3.1 enums → Task 1 (SQL) + Task 4 (Prisma) + Task 5 (TS types) ✓
- §3.2 personas → Task 1 + Task 4 ✓
- §3.3 vinculaciones → Task 1 + Task 4 ✓
- §4.1 rename FKs → Task 1 (SQL) + Task 4 (Prisma) ✓
- §4.2 drop trabajadores → Task 1 ✓
- §4.3 RLS → Task 1 (función) + Task 14 (policies) ✓
- §5.1 UI a modificar → Tasks 9, 10, 11 + Task 8 (script) ✓
- §5.2 UI nueva → Tasks 12, 13 ✓
- §6 plan de migración → Tasks 1-3 (DB) + Task 4 (Prisma) + Tasks 5-13 (código) + Task 14 (RLS) ✓
- §7 actualizaciones CLAUDE.md → Task 15 ✓
- §10 test plan → Task 16 (smoke test manual) ✓

**Placeholder scan:** revisé no quedan "TBD", "TODO", "implement later", "add error handling".

**Type consistency:** `persona_id` es BigInt en BD y Prisma; en TS lo usamos como `number` cuando viene serializado (vía `Number(persona.id)`), o `bigint` cuando viene directo de Prisma. Los formularios pasan como string en hidden fields. Consistente.

**Decisión menor confirmada en plan vs spec:**
- D-006 (fecha_inicio default): default `CURRENT_DATE` en SQL y formulario sin obligar al jefe. ✓
- D-009 (SOLO_DESTAJO en FIJO): NO se prohíbe en CHECK constraint — queda permitido por simplicidad, refinable después.
- D-012 (quitar APICULTOR de CLAUDE.md): aplicado en Task 15.
- D-007 (apellido separado): no se aplica — `nombre_completo` queda como un solo campo (cambio a `nombres` + `apellidos` sería otro spec).
