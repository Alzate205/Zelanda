-- ============================================================
-- Fase 6 - Capa financiera (paso 4): jornales
-- Un registro por persona/dia trabajado, con snapshot de la
-- tarifa aplicada (capturada al momento de registrar para que
-- cambios futuros en tarifas/vinculaciones no alteren el historico).
-- Diseno del spec docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS jornales (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id) ON DELETE NO ACTION,
  fecha                       DATE NOT NULL DEFAULT CURRENT_DATE,
  tarifa_aplicada             NUMERIC(12, 2) NOT NULL CHECK (tarifa_aplicada >= 0),
  lote_id                     BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
  descripcion_actividad       TEXT,
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_jornales_fecha
  ON jornales(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_jornales_persona_fecha
  ON jornales(persona_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_jornales_lote
  ON jornales(lote_id)
  WHERE lote_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_jornales_updated_at ON jornales;
CREATE TRIGGER trg_jornales_updated_at
  BEFORE UPDATE ON jornales
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE jornales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jornales_select ON jornales;
CREATE POLICY jornales_select ON jornales FOR SELECT
  USING (public.es_jefe());

DROP POLICY IF EXISTS jornales_insert ON jornales;
CREATE POLICY jornales_insert ON jornales FOR INSERT
  WITH CHECK (public.es_jefe() AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS jornales_update ON jornales;
CREATE POLICY jornales_update ON jornales FOR UPDATE
  USING (public.es_jefe());

DROP POLICY IF EXISTS jornales_delete ON jornales;
CREATE POLICY jornales_delete ON jornales FOR DELETE
  USING (public.es_jefe());

COMMIT;
