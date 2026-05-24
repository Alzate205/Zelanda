-- ============================================================
-- Fase 6 - Capa financiera (paso 3): servicios contratados
-- Contratos puntuales con contratistas: descripcion, monto pactado,
-- fechas, estado. Tambien agrega el FK pendiente desde
-- pagos.servicio_id que quedo como BIGINT en la migracion previa.
-- Diseno del spec docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE estado_servicio AS ENUM (
    'ACUERDO', 'EN_CURSO', 'TERMINADO', 'CANCELADO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS servicios_contratados (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id) ON DELETE NO ACTION,
  descripcion                 TEXT NOT NULL CHECK (length(trim(descripcion)) > 0),
  lote_id                     BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
  monto_pactado               NUMERIC(12, 2) NOT NULL CHECK (monto_pactado > 0),
  fecha_inicio                DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin                   DATE,
  estado                      estado_servicio NOT NULL DEFAULT 'ACUERDO',
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_servicios_persona
  ON servicios_contratados(persona_id);

CREATE INDEX IF NOT EXISTS idx_servicios_estado
  ON servicios_contratados(estado);

CREATE INDEX IF NOT EXISTS idx_servicios_lote
  ON servicios_contratados(lote_id)
  WHERE lote_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_servicios_updated_at ON servicios_contratados;
CREATE TRIGGER trg_servicios_updated_at
  BEFORE UPDATE ON servicios_contratados
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE servicios_contratados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_select ON servicios_contratados;
CREATE POLICY servicios_select ON servicios_contratados FOR SELECT
  USING (public.es_jefe());

DROP POLICY IF EXISTS servicios_insert ON servicios_contratados;
CREATE POLICY servicios_insert ON servicios_contratados FOR INSERT
  WITH CHECK (public.es_jefe() AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS servicios_update ON servicios_contratados;
CREATE POLICY servicios_update ON servicios_contratados FOR UPDATE
  USING (public.es_jefe());

DROP POLICY IF EXISTS servicios_delete ON servicios_contratados;
CREATE POLICY servicios_delete ON servicios_contratados FOR DELETE
  USING (public.es_jefe());

-- Agregar FK pendiente: pagos.servicio_id -> servicios_contratados.id
-- Idempotente: solo si no existe ya.
DO $$ BEGIN
  ALTER TABLE pagos
    ADD CONSTRAINT pagos_servicio_id_fkey
    FOREIGN KEY (servicio_id) REFERENCES servicios_contratados(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Constraint: si tipo='SERVICIO', servicio_id NO puede ser NULL.
-- (Esta vez aplicable porque la tabla referenciada existe.)
DO $$ BEGIN
  ALTER TABLE pagos
    ADD CONSTRAINT pagos_servicio_id_requerido_si_servicio
    CHECK ((tipo = 'SERVICIO' AND servicio_id IS NOT NULL) OR (tipo <> 'SERVICIO'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
