BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'despachos' AND column_name = 'asignacion_id'
  ) THEN
    ALTER TABLE despachos
      ADD COLUMN asignacion_id BIGINT REFERENCES asignaciones(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_despachos_asignacion ON despachos(asignacion_id);

COMMIT;
