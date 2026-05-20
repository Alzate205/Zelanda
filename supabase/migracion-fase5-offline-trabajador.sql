-- Sub-fase 5.2a: idempotencia para sync offline del trabajador
-- Agrega id_local UUID UNIQUE a tablas que aceptan creación desde cola offline.

ALTER TABLE registros_avance
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS id_local UUID NULL UNIQUE;

CREATE INDEX IF NOT EXISTS ix_registros_avance_id_local
  ON registros_avance(id_local) WHERE id_local IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_novedades_id_local
  ON novedades(id_local) WHERE id_local IS NOT NULL;
