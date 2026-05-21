-- Módulo de apicultura: estado de visita + tabla cosechas de miel.

DO $$ BEGIN
  CREATE TYPE estado_apiario AS ENUM ('BIEN', 'CON_PROBLEMAS', 'CRITICO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE registros_avance
  ADD COLUMN IF NOT EXISTS estado_apiario estado_apiario NULL;

CREATE TABLE IF NOT EXISTS cosechas_miel (
  id            BIGSERIAL PRIMARY KEY,
  apiario_id    BIGINT NOT NULL REFERENCES apiarios(id),
  persona_id    BIGINT NOT NULL REFERENCES personas(id),
  asignacion_id BIGINT NULL REFERENCES asignaciones(id),
  kg            DECIMAL(8, 2) NOT NULL CHECK (kg > 0),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas         TEXT NULL,
  registrado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS ix_cosechas_miel_apiario_fecha
  ON cosechas_miel(apiario_id, fecha DESC);

ALTER TABLE cosechas_miel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cosechas_miel select" ON cosechas_miel;
CREATE POLICY "cosechas_miel select" ON cosechas_miel
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cosechas_miel insert" ON cosechas_miel;
CREATE POLICY "cosechas_miel insert" ON cosechas_miel
  FOR INSERT TO authenticated WITH CHECK (true);
