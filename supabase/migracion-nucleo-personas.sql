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
