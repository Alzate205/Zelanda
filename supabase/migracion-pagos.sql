-- ============================================================
-- Fase 6 - Capa financiera (paso 2): registro generico de pagos
-- Tabla `pagos` que centraliza cualquier salida de plata hacia
-- una persona: salario, jornal, servicio, bono, adelanto, ajuste.
-- Diseno del spec docs/superpowers/specs/2026-05-11-capa-financiera-DRAFT.md
-- Nota: `servicio_id` queda como BIGINT sin FK; se agrega FK cuando
-- se construya `servicios_contratados`.
-- Ejecutar idempotente.
-- ============================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipo_pago AS ENUM (
    'SALARIO', 'ADELANTO', 'JORNAL', 'SERVICIO', 'BONO', 'AJUSTE', 'OTRO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pagos (
  id                          BIGSERIAL PRIMARY KEY,
  persona_id                  BIGINT NOT NULL REFERENCES personas(id) ON DELETE NO ACTION,
  monto                       NUMERIC(12, 2) NOT NULL,
  fecha                       DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo                        tipo_pago NOT NULL,
  servicio_id                 BIGINT,
  cubre_desde                 DATE,
  cubre_hasta                 DATE,
  monto_sugerido              NUMERIC(12, 2),
  motivo_diferencia           TEXT,
  metodo_pago                 TEXT,
  notas                       TEXT,
  registrado_por_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE NO ACTION,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((tipo = 'AJUSTE') OR (monto > 0)),
  CHECK (
    (cubre_desde IS NULL AND cubre_hasta IS NULL)
    OR (cubre_desde IS NOT NULL AND cubre_hasta IS NOT NULL AND cubre_hasta >= cubre_desde)
  )
);

CREATE INDEX IF NOT EXISTS idx_pagos_persona_fecha
  ON pagos(persona_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_fecha
  ON pagos(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_tipo
  ON pagos(tipo);

CREATE INDEX IF NOT EXISTS idx_pagos_servicio
  ON pagos(servicio_id)
  WHERE servicio_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pagos_updated_at ON pagos;
CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON pagos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Solo jefe puede ver / crear / editar / borrar pagos
DROP POLICY IF EXISTS pagos_select ON pagos;
CREATE POLICY pagos_select ON pagos FOR SELECT
  USING (public.es_jefe());

DROP POLICY IF EXISTS pagos_insert ON pagos;
CREATE POLICY pagos_insert ON pagos FOR INSERT
  WITH CHECK (public.es_jefe() AND registrado_por_usuario_id = auth.uid());

DROP POLICY IF EXISTS pagos_update ON pagos;
CREATE POLICY pagos_update ON pagos FOR UPDATE
  USING (public.es_jefe());

DROP POLICY IF EXISTS pagos_delete ON pagos;
CREATE POLICY pagos_delete ON pagos FOR DELETE
  USING (public.es_jefe());

COMMIT;
