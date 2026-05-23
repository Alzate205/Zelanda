-- ============================================================
-- Fase 6 - Capa financiera (paso 1): catalogo de tarifas por tarea
-- Tabla `tarifas_tarea` con esquema de pago, monto, vigencia temporal
-- y override opcional por lote.
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

-- Enum solo si no existe
DO $$ BEGIN
  CREATE TYPE esquema_pago_actividad AS ENUM (
    'POR_JORNAL', 'POR_KG', 'POR_ARBOL', 'POR_HECTAREA', 'POR_HORA', 'OTRO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tarifas_tarea (
  id                          BIGSERIAL PRIMARY KEY,
  tipo_tarea_id               BIGINT NOT NULL REFERENCES tipos_tarea(id) ON DELETE CASCADE,
  esquema_pago                esquema_pago_actividad NOT NULL,
  monto                       NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  unidad                      TEXT,
  vigente_desde               DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta               DATE,
  lote_id                     BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_tarea_tipo
  ON tarifas_tarea(tipo_tarea_id);

CREATE INDEX IF NOT EXISTS idx_tarifas_tarea_vigentes
  ON tarifas_tarea(tipo_tarea_id, vigente_desde DESC)
  WHERE vigente_hasta IS NULL;

CREATE INDEX IF NOT EXISTS idx_tarifas_tarea_lote
  ON tarifas_tarea(lote_id)
  WHERE lote_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_tarifas_tarea_updated_at ON tarifas_tarea;
CREATE TRIGGER trg_tarifas_tarea_updated_at
  BEFORE UPDATE ON tarifas_tarea
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE tarifas_tarea ENABLE ROW LEVEL SECURITY;

-- SELECT: jefe ve todas; el resto (de momento) no
DROP POLICY IF EXISTS tarifas_select ON tarifas_tarea;
CREATE POLICY tarifas_select ON tarifas_tarea FOR SELECT
  USING (public.es_jefe());

DROP POLICY IF EXISTS tarifas_insert ON tarifas_tarea;
CREATE POLICY tarifas_insert ON tarifas_tarea FOR INSERT
  WITH CHECK (public.es_jefe() AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS tarifas_update ON tarifas_tarea;
CREATE POLICY tarifas_update ON tarifas_tarea FOR UPDATE
  USING (public.es_jefe());

DROP POLICY IF EXISTS tarifas_delete ON tarifas_tarea;
CREATE POLICY tarifas_delete ON tarifas_tarea FOR DELETE
  USING (public.es_jefe());

COMMIT;
