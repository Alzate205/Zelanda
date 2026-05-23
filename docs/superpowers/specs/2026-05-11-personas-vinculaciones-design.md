# Personas y Vínculos — núcleo del modelo de personal

**Fecha:** 2026-05-11
**Estado:** Borrador para revisión y luego implementación
**Autor:** Claude + dueño
**Scope:** Núcleo general y usable. La capa financiera (pagos, tarifas, servicios contratados, jornales, ausencias) es un spec separado (`2026-05-11-capa-financiera-DRAFT.md`) que se implementa en una fase posterior.

## 1. Contexto

El esquema actual asume que toda persona en la finca es un `trabajador` con `salario_base`. La realidad de La Zelanda es más rica: hay **fijos, jornaleros, contratistas y familia/propietarios**, y la misma persona puede transitar entre esos vínculos a lo largo del tiempo.

Este spec rediseña la capa de **identidad de personas** (quiénes son y qué relación tienen con la finca) sin tocar todavía el dinero. El objetivo es que el sistema soporte los cuatro perfiles desde el día uno, con histórico de vínculos, y mantenga el login/equipo funcionando.

Cuando este núcleo esté en producción, sigue la capa financiera (ver DRAFT hermano).

## 2. Decisiones de dominio confirmadas

| # | Decisión | Origen |
|---|---|---|
| D1 | Existen 4 perfiles: **fijos, jornaleros, contratistas, familia** | Brainstorm 2026-05-11 |
| D2 | La misma persona puede tener **distintos vínculos en el tiempo** con histórico | D1 |
| D3 | Los jornaleros se identifican **individualmente** (nombre/cédula), no agregado | D1 |
| D4 | **No hay rol "apicultor"** — las tareas de apicultura se asignan a cualquier trabajador disponible. (CLAUDE.md §4.4 actual queda obsoleto). | D1 |
| D5 | Email **no se modela** — casi nadie tiene en la finca | D1 |
| D6 | El esquema de pago de cada fijo es **un acuerdo individual** (destajo suma vs reemplaza día); guardado en `vinculaciones.esquema_pago_destajo`. La *aplicación* de ese esquema vive en la capa financiera (no en este spec). | D1 |

## 3. Esquema núcleo

### 3.1 Enums nuevos

```sql
CREATE TYPE tipo_vinculacion AS ENUM (
  'FIJO',         -- empleado con sueldo periódico
  'JORNALERO',    -- contratado por días
  'CONTRATISTA',  -- contratado por servicio puntual
  'FAMILIAR'      -- familia / propietario, no asalariado
);

CREATE TYPE tipo_periodo_pago AS ENUM (
  'MENSUAL', 'QUINCENAL', 'SEMANAL'
);

CREATE TYPE esquema_pago_destajo AS ENUM (
  'NUNCA',          -- no hace destajo, solo sueldo
  'ADICIONAL',      -- destajo suma al pago del día
  'REEMPLAZA_DIA',  -- destajo reemplaza el pago del día normal
  'SOLO_DESTAJO'    -- sin sueldo base, todo destajo (raro)
);
```

### 3.2 `personas`

Identidad. Reemplaza `trabajadores`. Solo datos invariantes de la persona.

```sql
CREATE TABLE personas (
  id                BIGSERIAL PRIMARY KEY,
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
```

**Removidos respecto a `trabajadores` actual:**
- `rol_finca` → se mueve a `vinculaciones.rol_finca`.
- `es_apicultor` → eliminado (ver D4).
- `salario_base`, `fecha_ingreso` → se mueven a `vinculaciones`.

### 3.3 `vinculaciones`

Cada fila es un "spell" de relación entre una persona y la finca. Permite histórico.

```sql
CREATE TABLE vinculaciones (
  id                      BIGSERIAL PRIMARY KEY,
  persona_id              BIGINT NOT NULL REFERENCES personas(id),
  tipo                    tipo_vinculacion NOT NULL,
  rol_finca               TEXT,
  fecha_inicio            DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin               DATE,

  -- Solo para FIJO:
  salario_base            NUMERIC(12,2),
  periodo_pago            tipo_periodo_pago,

  -- Solo para JORNALERO:
  tarifa_jornal           NUMERIC(12,2),

  -- Para FIJO y JORNALERO (nullable; default decidido a nivel app):
  esquema_pago_destajo    esquema_pago_destajo,

  notas                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  CHECK (
    (tipo = 'FIJO'        AND salario_base IS NOT NULL AND periodo_pago IS NOT NULL AND tarifa_jornal IS NULL)
    OR
    (tipo = 'JORNALERO'   AND tarifa_jornal IS NOT NULL AND salario_base IS NULL AND periodo_pago IS NULL)
    OR
    (tipo IN ('CONTRATISTA','FAMILIAR') AND salario_base IS NULL AND tarifa_jornal IS NULL AND periodo_pago IS NULL)
  )
);

CREATE INDEX idx_vinculaciones_persona ON vinculaciones(persona_id);
CREATE UNIQUE INDEX uq_vinculacion_activa
  ON vinculaciones(persona_id) WHERE fecha_fin IS NULL;
```

**Una persona tiene a lo más un vínculo activo a la vez.** Si cambia de tipo, se cierra el anterior (`fecha_fin = hoy`) y se inserta uno nuevo.

Los campos `esquema_pago_destajo`, `salario_base`, `tarifa_jornal`, `periodo_pago` viven en `vinculaciones` desde el día uno aunque la capa financiera no esté implementada — guardarlos como dato no cuesta, y evita migrar tabla otra vez.

## 4. Cambios en tablas existentes

### 4.1 Renombre de columna `trabajador_id` → `persona_id`

En:
- `usuarios.trabajador_id`
- `asignaciones.trabajador_id`
- `registros_avance.trabajador_id`
- `novedades.trabajador_id`
- `despachos.trabajador_id`
- `cosechas.trabajador_id`

Las FK apuntan a `personas(id)`.

### 4.2 Eliminación de la tabla `trabajadores`

Después de migrar datos a `personas` y `vinculaciones`, drop `trabajadores`. El concepto pasa a ser **una persona con vinculación FIJO o JORNALERO activa**.

### 4.3 RLS — actualización de funciones helper

Reemplazar `trabajador_id_actual()` por `persona_id_actual()`. Actualizar todas las policies en `supabase/policies.sql` que lo referencian.

Nuevas policies para tablas nuevas:
- `personas`: SELECT autenticado, INSERT/UPDATE/DELETE solo JEFE.
- `vinculaciones`: SELECT propio (`persona_id = persona_id_actual()`) o JEFE, INSERT/UPDATE solo JEFE.

## 5. UI — pantallas afectadas (núcleo)

### 5.1 Existentes a modificar

| Pantalla | Cambio |
|---|---|
| `/jefe/equipo` (lista) | Mostrar el `tipo` de vinculación activo + `rol_finca`. Filtros por tipo. |
| `/jefe/equipo/nuevo` | Formulario rediseñado: datos de persona + vinculación inicial. Campos condicionales según `tipo` seleccionado (FIJO pide `salario_base` + `periodo_pago`; JORNALERO pide `tarifa_jornal`; CONTRATISTA/FAMILIAR sin esos). |
| `scripts/crear-primer-jefe.mjs` | Insertar `persona` + `vinculacion` (tipo `FAMILIAR` por defecto, o `FIJO` si quiere recibir sueldo via app). |
| `lib/auth.ts`, layouts | Resolver `usuario → persona → vinculación activa` para mostrar el `rol_finca` correctamente. |

### 5.2 Nuevas pantallas mínimas

| Ruta | Propósito |
|---|---|
| `/jefe/equipo/[id]` | Detalle de persona: datos personales + vinculación activa + línea de tiempo de vinculaciones pasadas. |
| `/jefe/equipo/[id]/editar` | Editar datos de la persona y/o cambiar de vinculación (cierra la activa, crea una nueva). |

Las pantallas de finanzas, configuración de tarifas, servicios contratados y pagos quedan **fuera del scope** de este spec.

## 6. Plan de migración

La app está recién desplegada con 1 jefe creado y 0 trabajadores reales. **No hay data en producción que migrar más allá del jefe**.

### 6.1 Pasos

1. **SQL de migración** (en `supabase/migracion-nucleo-personas.sql`):
   - `CREATE TYPE` para los 3 enums nuevos.
   - `CREATE TABLE personas, vinculaciones`.
   - Ejecutar en Supabase SQL Editor.
2. **Migrar datos existentes** (única fila: el jefe):
   - `INSERT INTO personas` desde `trabajadores` (mapeo de columnas).
   - `INSERT INTO vinculaciones` con `tipo='FAMILIAR'` (o `FIJO` si así prefiere). Resolver al momento.
3. **Renombrar columnas FK**:
   - `ALTER TABLE usuarios RENAME COLUMN trabajador_id TO persona_id`.
   - Idem en `asignaciones`, `registros_avance`, `novedades`, `despachos`, `cosechas`.
   - Recrear FKs apuntando a `personas(id)`.
4. **DROP TABLE trabajadores** después de verificar integridad.
5. **Actualizar RLS** (`supabase/policies.sql`):
   - Renombrar función `trabajador_id_actual()` → `persona_id_actual()`.
   - Actualizar referencias en policies.
   - Agregar policies para `personas` y `vinculaciones`.
6. **Actualizar Prisma schema** (`prisma/schema.prisma`): reflejar todos los cambios.
7. **Actualizar código de la app:**
   - `lib/auth.ts`, `lib/constantes.ts`, `types/index.ts`.
   - Server actions y server components que usan `trabajador*` → `persona*`.
   - Pantallas de equipo (lista, nuevo, detalle).
   - `scripts/crear-primer-jefe.mjs`.
   - Regenerar Prisma client.
8. **Verificación:**
   - `npm run lint`, `npx tsc --noEmit`, `npm run build`.
   - Smoke test: login del jefe existente sigue funcionando; crear un nuevo miembro tipo JORNALERO; ver el detalle; cambiarle el tipo a FIJO; ver el histórico.

### 6.2 Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos al renombrar columnas | Backup automático de Supabase + migración escrita como script idempotente |
| Inconsistencia entre Prisma schema y BD real | `prisma db pull --print` después de la migración y diff contra el schema escrito |
| RLS rota durante la migración | Pausar policies (`DISABLE ROW LEVEL SECURITY`) durante el cambio y rehabilitar al final |
| Código viejo que aún referencia `trabajadores` | grep + typecheck antes de push |

## 7. Actualizaciones a CLAUDE.md

Después de implementar, editar:

- **§4 (Roles de usuario):** quitar el sub-rol APICULTOR. Aclarar que `rol_finca` es separado del rol del sistema y es texto libre.
- **§5.5 (Apicultura):** quitar "solo a apicultores se les asignan". Tareas de apicultura → cualquier trabajador disponible.
- **§5.6 (Equipo / Trabajadores):** reemplazar por "Personas y Vínculos" — describir los 4 tipos de vinculación y el modelo `personas + vinculaciones`.
- **§6 (Esquema de BD):** mencionar `personas` y `vinculaciones`; señalar que `trabajadores` ya no existe y que la capa financiera tendrá tablas adicionales (futura Fase 2).

## 8. Próximos specs después de este

- **Capa financiera** (`2026-05-11-capa-financiera-DRAFT.md`): se reabre y refina cuando el núcleo esté funcionando en producción. Trae las 5 tablas (`pagos`, `tarifas_tarea`, `servicios_contratados`, `jornales`, `ausencias`), la lógica de cálculo de saldos y las pantallas de configuración, servicios y pagos.

## 9. Decisiones pendientes que afectan este núcleo

Ver `docs/decisiones-pendientes.md`:
- **D-006** vinculaciones.fecha_inicio default
- **D-007** apellido separado del nombre
- **D-009** esquema_pago_destajo='SOLO_DESTAJO' válido para FIJO?
- **D-012** confirmar quitar APICULTOR de CLAUDE.md (resolución previa: sí)

Las decisiones D-001 a D-005, D-008, D-010, D-011 son de capa financiera y se resuelven cuando se reabra el DRAFT.

## 10. Test plan (manual, no automatizado en esta fase)

- Login del jefe existente funciona después de migración.
- Crear un nuevo miembro tipo JORNALERO con tarifa_jornal — se inserta correctamente.
- Intentar crear vinculación tipo FIJO sin salario_base → CHECK constraint rechaza.
- Crear un segundo vínculo activo para la misma persona → UNIQUE INDEX rechaza.
- Cambiar el tipo de vinculación de un fijo a contratista → se cierra el FIJO con fecha_fin, se crea CONTRATISTA, histórico visible en detalle.
- Asignar una tarea a la persona (con la app existente) → la FK `persona_id` resuelve correctamente.
- Trabajador no-JEFE ve solo su propia persona en `/jefe/equipo` (no, en este caso no tiene acceso a `/jefe/equipo` — pero verificar que ve su propia info donde aplique).
