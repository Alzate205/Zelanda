-- ============================================================
-- Tabla recordatorios: notas/avisos manuales con fecha y asignado
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS recordatorios (
  id                          BIGSERIAL PRIMARY KEY,
  titulo                      TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
  descripcion                 TEXT,
  fecha                       DATE NOT NULL,
  asignado_a_persona_id       BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  creado_por_persona_id       BIGINT REFERENCES personas(id) ON DELETE SET NULL,
  creado_por_usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  completado_en               TIMESTAMPTZ,
  completado_por_persona_id   BIGINT REFERENCES personas(id) ON DELETE SET NULL,
  notas_completado            TEXT,
  push_enviado_en             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (completado_en IS NULL AND completado_por_persona_id IS NULL AND notas_completado IS NULL)
    OR (completado_en IS NOT NULL AND completado_por_persona_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_asignado_fecha
  ON recordatorios(asignado_a_persona_id, fecha)
  WHERE completado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordatorios_fecha_pendientes
  ON recordatorios(fecha)
  WHERE completado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordatorios_creador
  ON recordatorios(creado_por_persona_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_recordatorios_updated_at ON recordatorios;
CREATE TRIGGER trg_recordatorios_updated_at
  BEFORE UPDATE ON recordatorios
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE recordatorios ENABLE ROW LEVEL SECURITY;

-- SELECT: el asignado, el creador, o el jefe
DROP POLICY IF EXISTS recordatorios_select ON recordatorios;
CREATE POLICY recordatorios_select ON recordatorios FOR SELECT
  USING (
    public.es_jefe()
    OR asignado_a_persona_id = public.persona_id_actual()
    OR creado_por_persona_id = public.persona_id_actual()
  );

-- INSERT: cualquier usuario autenticado con persona vinculada
DROP POLICY IF EXISTS recordatorios_insert ON recordatorios;
CREATE POLICY recordatorios_insert ON recordatorios FOR INSERT
  WITH CHECK (
    creado_por_usuario_id = auth.uid()
    AND (
      public.es_jefe()
      OR asignado_a_persona_id = public.persona_id_actual()
    )
  );

-- UPDATE: el asignado puede marcarlo como hecho; el creador puede editar; el jefe puede todo
DROP POLICY IF EXISTS recordatorios_update ON recordatorios;
CREATE POLICY recordatorios_update ON recordatorios FOR UPDATE
  USING (
    public.es_jefe()
    OR asignado_a_persona_id = public.persona_id_actual()
    OR creado_por_persona_id = public.persona_id_actual()
  );

-- DELETE: solo el creador o el jefe
DROP POLICY IF EXISTS recordatorios_delete ON recordatorios;
CREATE POLICY recordatorios_delete ON recordatorios FOR DELETE
  USING (
    public.es_jefe()
    OR creado_por_persona_id = public.persona_id_actual()
  );

COMMIT;
