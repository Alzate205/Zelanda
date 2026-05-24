-- ============================================================
-- Fase 6 - Capa financiera (paso 5): ausencias
-- Dias no trabajados de una persona, con tipo y flag descontable
-- (si descuenta del salario o no). Necesario para calcular dias
-- efectivos de un FIJO.
-- Default descontable segun tipo (D-005 propuesta tentativa):
--   FALTA_INJUSTIFICADA / LICENCIA / PERMISO -> TRUE
--   INCAPACIDAD / VACACIONES -> FALSE
-- El jefe puede override en la UI.
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipo_ausencia AS ENUM (
    'FALTA_INJUSTIFICADA', 'INCAPACIDAD', 'VACACIONES', 'LICENCIA', 'PERMISO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ausencias (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id) ON DELETE NO ACTION,
  fecha                       DATE NOT NULL,
  tipo                        tipo_ausencia NOT NULL,
  descontable                 BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones               TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_ausencias_persona_fecha
  ON ausencias(persona_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_ausencias_fecha
  ON ausencias(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_ausencias_descontables
  ON ausencias(persona_id, fecha)
  WHERE descontable = TRUE;

DROP TRIGGER IF EXISTS trg_ausencias_updated_at ON ausencias;
CREATE TRIGGER trg_ausencias_updated_at
  BEFORE UPDATE ON ausencias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ausencias_select ON ausencias;
CREATE POLICY ausencias_select ON ausencias FOR SELECT
  USING (public.es_jefe());

DROP POLICY IF EXISTS ausencias_insert ON ausencias;
CREATE POLICY ausencias_insert ON ausencias FOR INSERT
  WITH CHECK (public.es_jefe() AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS ausencias_update ON ausencias;
CREATE POLICY ausencias_update ON ausencias FOR UPDATE
  USING (public.es_jefe());

DROP POLICY IF EXISTS ausencias_delete ON ausencias;
CREATE POLICY ausencias_delete ON ausencias FOR DELETE
  USING (public.es_jefe());

COMMIT;
